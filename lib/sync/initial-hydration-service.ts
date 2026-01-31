/**
 * Initial Hydration Service
 *
 * Performs first-time data sync from Supabase to WatermelonDB.
 * Addresses the "Initial Hydration Void" - local database starts empty.
 *
 * CTO MANDATES:
 * - One-shot Bootstrap: Runs once on first app load (per device/user)
 * - Graceful Degradation: Falls back to online-only if hydration fails
 * - Sync Status: All hydrated records marked 'synced' (from server)
 * - No N+1 Queries: Batch fetches from Supabase
 *
 * Hydration Order (dependency-aware):
 * 1. Global currencies (reference data, no dependencies)
 * 2. Categories (no dependencies)
 * 3. Accounts (no dependencies)
 * 4. Transactions (depends on accounts, categories)
 * 5. Inbox (depends on accounts, categories)
 *
 * @module sync/initial-hydration-service
 */

import type { Database as WatermelonDatabase } from '@nozbe/watermelondb';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database as SupabaseDatabase } from '@/types/supabase';
import { Q } from '@nozbe/watermelondb';
import {
  AccountModel,
  CategoryModel,
  TransactionModel,
  InboxModel,
  CurrencyModel,
  SyncMetadataModel,
  TABLE_NAMES,
  SYNC_STATUS,
} from '@/lib/local-db';
import { getVersion, type VersionedRow } from './type-utils';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Hydration result status
 */
export type HydrationStatus =
  | 'not_needed'      // Already hydrated
  | 'completed'       // Successfully hydrated
  | 'partial'         // Some tables hydrated, others failed
  | 'failed'          // Hydration failed completely
  | 'skipped';        // No WatermelonDB available (graceful degradation)

/**
 * Hydration result with detailed stats
 */
export interface HydrationResult {
  status: HydrationStatus;
  stats: {
    currencies: number;
    accounts: number;
    categories: number;
    transactions: number;
    inbox: number;
  };
  errors: Array<{ table: string; error: string }>;
  durationMs: number;
}

/**
 * Initial Hydration Service Interface
 */
export interface IInitialHydrationService {
  /**
   * Check if initial hydration is needed
   */
  isHydrationNeeded(): Promise<boolean>;

  /**
   * Perform initial hydration from Supabase to WatermelonDB
   */
  hydrate(userId: string): Promise<HydrationResult>;

  /**
   * Force re-hydration (for debugging/recovery)
   * Clears local data and re-fetches from server
   */
  forceRehydrate(userId: string): Promise<HydrationResult>;
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * Initial Hydration Service
 *
 * Performs one-time data sync from Supabase to WatermelonDB.
 */
export class InitialHydrationService implements IInitialHydrationService {
  private static readonly HYDRATION_MARKER_TABLE = 'bank_accounts';
  private static readonly BATCH_SIZE = 1000;

  constructor(
    private readonly database: WatermelonDatabase,
    private readonly supabase: SupabaseClient<SupabaseDatabase>
  ) {}

  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================

  /**
   * Check if initial hydration is needed
   *
   * Hydration is needed if sync_metadata has no records OR
   * if the accounts table is empty (simplest check).
   */
  async isHydrationNeeded(): Promise<boolean> {
    try {
      // Check sync_metadata for hydration marker
      const syncMetadata = await this.database
        .get<SyncMetadataModel>(TABLE_NAMES.SYNC_METADATA)
        .query()
        .fetch();

      // If sync_metadata exists with entries, hydration is done
      if (syncMetadata.length > 0) {
        console.log('[Hydration] Found sync_metadata entries, hydration not needed');
        return false;
      }

      // Double-check by looking at accounts (most fundamental table)
      const accountCount = await this.database
        .get<AccountModel>(TABLE_NAMES.BANK_ACCOUNTS)
        .query()
        .fetchCount();

      if (accountCount > 0) {
        console.log('[Hydration] Found existing accounts, hydration not needed');
        return false;
      }

      console.log('[Hydration] No existing data found, hydration needed');
      return true;
    } catch (error) {
      console.error('[Hydration] Error checking hydration status:', error);
      // If we can't check, assume hydration is needed
      return true;
    }
  }

  /**
   * Perform initial hydration
   *
   * Fetches all data from Supabase and stores in WatermelonDB.
   * Records are marked as 'synced' since they came from server.
   */
  async hydrate(userId: string): Promise<HydrationResult> {
    const startTime = Date.now();
    const stats = { currencies: 0, accounts: 0, categories: 0, transactions: 0, inbox: 0 };
    const errors: Array<{ table: string; error: string }> = [];

    console.log('[Hydration] Starting initial hydration for user:', userId);

    try {
      // Step 1: Hydrate global currencies (reference data)
      try {
        stats.currencies = await this.hydrateCurrencies();
        console.log(`[Hydration] Hydrated ${stats.currencies} currencies`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({ table: 'global_currencies', error: message });
        console.error('[Hydration] Failed to hydrate currencies:', error);
      }

      // Step 2: Hydrate categories (no dependencies)
      try {
        stats.categories = await this.hydrateCategories(userId);
        console.log(`[Hydration] Hydrated ${stats.categories} categories`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({ table: 'categories', error: message });
        console.error('[Hydration] Failed to hydrate categories:', error);
      }

      // Step 3: Hydrate accounts (no dependencies)
      try {
        stats.accounts = await this.hydrateAccounts(userId);
        console.log(`[Hydration] Hydrated ${stats.accounts} accounts`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({ table: 'bank_accounts', error: message });
        console.error('[Hydration] Failed to hydrate accounts:', error);
      }

      // Step 4: Hydrate transactions (depends on accounts, categories)
      try {
        stats.transactions = await this.hydrateTransactions(userId);
        console.log(`[Hydration] Hydrated ${stats.transactions} transactions`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({ table: 'transactions', error: message });
        console.error('[Hydration] Failed to hydrate transactions:', error);
      }

      // Step 5: Hydrate inbox (depends on accounts, categories)
      try {
        stats.inbox = await this.hydrateInbox(userId);
        console.log(`[Hydration] Hydrated ${stats.inbox} inbox items`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({ table: 'transaction_inbox', error: message });
        console.error('[Hydration] Failed to hydrate inbox:', error);
      }

      // Step 6: Mark hydration complete in sync_metadata
      await this.markHydrationComplete(userId);

      const durationMs = Date.now() - startTime;
      const status: HydrationStatus =
        errors.length === 0 ? 'completed' : errors.length === 5 ? 'failed' : 'partial';

      console.log(`[Hydration] Completed in ${durationMs}ms with status: ${status}`);

      return { status, stats, errors, durationMs };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Hydration] Critical failure:', error);

      return {
        status: 'failed',
        stats,
        errors: [{ table: 'critical', error: message }],
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Force re-hydration
   *
   * Clears local data and performs fresh hydration.
   * Use for debugging or recovery scenarios.
   */
  async forceRehydrate(userId: string): Promise<HydrationResult> {
    console.log('[Hydration] Force re-hydration requested');

    try {
      // Clear sync_metadata to allow re-hydration
      await this.database.write(async () => {
        const syncMetadata = await this.database
          .get<SyncMetadataModel>(TABLE_NAMES.SYNC_METADATA)
          .query()
          .fetch();

        for (const record of syncMetadata) {
          await record.destroyPermanently();
        }
      });

      // Clear all data tables
      await this.clearAllTables();

      // Perform fresh hydration
      return this.hydrate(userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Hydration] Force re-hydration failed:', error);

      return {
        status: 'failed',
        stats: { currencies: 0, accounts: 0, categories: 0, transactions: 0, inbox: 0 },
        errors: [{ table: 'force_rehydrate', error: message }],
        durationMs: 0,
      };
    }
  }

  // ==========================================================================
  // PRIVATE: TABLE-SPECIFIC HYDRATION
  // ==========================================================================

  /**
   * Hydrate global currencies (reference data)
   */
  private async hydrateCurrencies(): Promise<number> {
    const { data, error } = await this.supabase
      .from('global_currencies')
      .select('*')
      .order('code');

    if (error) throw new Error(`Supabase error: ${error.message}`);
    if (!data || data.length === 0) return 0;

    await this.database.write(async () => {
      const collection = this.database.get<CurrencyModel>(TABLE_NAMES.GLOBAL_CURRENCIES);

      for (const row of data) {
        await collection.create((record) => {
          record._raw.id = row.code; // Use currency code as ID
          record.code = row.code;
          record.name = row.name;
          record.symbol = row.symbol;
          record.flag = row.flag;
        });
      }
    });

    return data.length;
  }

  /**
   * Hydrate accounts
   */
  private async hydrateAccounts(userId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('bank_accounts')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (error) throw new Error(`Supabase error: ${error.message}`);
    if (!data || data.length === 0) return 0;

    await this.database.write(async () => {
      const collection = this.database.get<AccountModel>(TABLE_NAMES.BANK_ACCOUNTS);

      for (const row of data) {
        await collection.create((record) => {
          record._raw.id = row.id;
          record.groupId = row.group_id;
          record.userId = row.user_id;
          record.name = row.name;
          record.type = row.type as AccountModel['type'];
          record.currencyCode = row.currency_code;
          record.color = row.color;
          record.isVisible = row.is_visible;
          // Convert decimal to cents (string-based for precision)
          record.currentBalanceCents = this.toCents(row.current_balance);

          // Sync fields - mark as synced (came from server)
          record.version = getVersion(row as VersionedRow);
          record.deletedAt = null;
          record.localSyncStatus = SYNC_STATUS.SYNCED;
        });
      }
    });

    return data.length;
  }

  /**
   * Hydrate categories
   */
  private async hydrateCategories(userId: string): Promise<number> {
    // Fetch user categories + system categories (user_id is null for system)
    const { data, error } = await this.supabase
      .from('categories')
      .select('*')
      .or(`user_id.eq.${userId},user_id.is.null`)
      .is('deleted_at', null);

    if (error) throw new Error(`Supabase error: ${error.message}`);
    if (!data || data.length === 0) return 0;

    await this.database.write(async () => {
      const collection = this.database.get<CategoryModel>(TABLE_NAMES.CATEGORIES);

      for (const row of data) {
        await collection.create((record) => {
          record._raw.id = row.id;
          record.userId = row.user_id ?? null;
          record.name = row.name;
          record.type = row.type as CategoryModel['type'];
          record.color = row.color;
          record.parentId = row.parent_id;

          // Sync fields - mark as synced (came from server)
          record.version = getVersion(row as VersionedRow);
          record.deletedAt = null;
          record.localSyncStatus = SYNC_STATUS.SYNCED;
        });
      }
    });

    return data.length;
  }

  /**
   * Hydrate transactions (paginated for large datasets)
   */
  private async hydrateTransactions(userId: string): Promise<number> {
    let totalCount = 0;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await this.supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('date', { ascending: false })
        .range(offset, offset + InitialHydrationService.BATCH_SIZE - 1);

      if (error) throw new Error(`Supabase error: ${error.message}`);
      if (!data || data.length === 0) {
        hasMore = false;
        continue;
      }

      await this.database.write(async () => {
        const collection = this.database.get<TransactionModel>(TABLE_NAMES.TRANSACTIONS);

        for (const row of data) {
          await collection.create((record) => {
            record._raw.id = row.id;
            record.userId = row.user_id;
            record.accountId = row.account_id;
            record.categoryId = row.category_id;
            // Direct BIGINT pass-through after Move 0 migration
            record.amountCents = Number(row.amount_cents);
            record.amountHomeCents = Number(row.amount_home_cents ?? row.amount_cents);
            record.exchangeRate = Number(row.exchange_rate ?? 1);
            record.date = new Date(row.date);
            record.description = row.description;
            record.notes = row.notes;
            record.sourceText = row.source_text;
            record.transferId = row.transfer_id;
            record.inboxId = row.inbox_id;
            record.cleared = row.cleared ?? false;
            record.reconciliationId = row.reconciliation_id;

            // Sync fields - mark as synced (came from server)
            record.version = getVersion(row as VersionedRow);
            record.deletedAt = null;
            record.localSyncStatus = SYNC_STATUS.SYNCED;
          });
        }
      });

      totalCount += data.length;
      offset += InitialHydrationService.BATCH_SIZE;
      hasMore = data.length === InitialHydrationService.BATCH_SIZE;
    }

    return totalCount;
  }

  /**
   * Hydrate inbox items
   */
  private async hydrateInbox(userId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('transaction_inbox')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .eq('status', 'pending'); // Only hydrate pending items

    if (error) throw new Error(`Supabase error: ${error.message}`);
    if (!data || data.length === 0) return 0;

    await this.database.write(async () => {
      const collection = this.database.get<InboxModel>(TABLE_NAMES.TRANSACTION_INBOX);

      for (const row of data) {
        await collection.create((record) => {
          record._raw.id = row.id;
          record.userId = row.user_id;
          // Direct BIGINT pass-through
          record.amountCents = row.amount_cents ? Number(row.amount_cents) : null;
          record.description = row.description;
          record.date = row.date ? new Date(row.date) : null;
          record.sourceText = row.source_text;
          record.accountId = row.account_id;
          record.categoryId = row.category_id;
          record.exchangeRate = row.exchange_rate ? Number(row.exchange_rate) : null;
          record.notes = row.notes;
          record.status = row.status as InboxModel['status'];

          // Sync fields - mark as synced (came from server)
          record.version = getVersion(row as VersionedRow);
          record.deletedAt = null;
          record.localSyncStatus = SYNC_STATUS.SYNCED;
        });
      }
    });

    return data.length;
  }

  // ==========================================================================
  // PRIVATE: UTILITY METHODS
  // ==========================================================================

  /**
   * Mark hydration complete in sync_metadata
   *
   * Fetches the current max version from Supabase and stores it
   * as the starting point for delta sync.
   */
  private async markHydrationComplete(userId: string): Promise<void> {
    // Fetch max version from server for delta sync starting point
    let maxVersion = 0;
    try {
      // Note: This RPC is defined in 20260126000004_global_version_rpc.sql
      // Type assertion needed until types are regenerated after migration
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (this.supabase.rpc as any)(
        'get_max_version_for_user',
        { p_user_id: userId }
      );

      if (!error && data) {
        maxVersion = (data as { maxVersion: number }).maxVersion || 0;
        console.log(`[Hydration] Max server version: ${maxVersion}`);
      }
    } catch (err) {
      console.warn('[Hydration] Could not fetch max version, defaulting to 0:', err);
    }

    const tables = [
      TABLE_NAMES.BANK_ACCOUNTS,
      TABLE_NAMES.CATEGORIES,
      TABLE_NAMES.TRANSACTIONS,
      TABLE_NAMES.TRANSACTION_INBOX,
    ];

    await this.database.write(async () => {
      const collection = this.database.get<SyncMetadataModel>(TABLE_NAMES.SYNC_METADATA);

      for (const tableName of tables) {
        await collection.create((record) => {
          record._raw.id = `${userId}_${tableName}`;
          record.tableName = tableName;
          record.lastSyncedVersion = maxVersion; // Start delta sync from here
          record.syncError = null;
        });
      }
    });
  }

  /**
   * Clear all data tables (for force re-hydration)
   */
  private async clearAllTables(): Promise<void> {
    const tables = [
      TABLE_NAMES.TRANSACTIONS,
      TABLE_NAMES.TRANSACTION_INBOX,
      TABLE_NAMES.BANK_ACCOUNTS,
      TABLE_NAMES.CATEGORIES,
      TABLE_NAMES.GLOBAL_CURRENCIES,
    ];

    await this.database.write(async () => {
      for (const tableName of tables) {
        const records = await this.database.get(tableName).query().fetch();
        for (const record of records) {
          await record.destroyPermanently();
        }
      }
    });
  }

  /**
   * Convert decimal to integer cents (string-based for precision)
   *
   * CTO Mandate: TRUE string-based parsing - NO binary float multiplication.
   */
  private toCents(decimal: number | string | null): number {
    if (decimal === null || decimal === undefined) {
      return 0;
    }

    const str = typeof decimal === 'string' ? decimal : decimal.toString();
    const isNegative = str.startsWith('-');
    const absStr = isNegative ? str.slice(1) : str;

    const parts = absStr.split('.');
    const wholePart = parts[0] || '0';
    let fractionalPart = parts[1] || '00';

    // Normalize to 2 digits
    if (fractionalPart.length === 1) {
      fractionalPart = fractionalPart + '0';
    } else if (fractionalPart.length > 2) {
      const thirdDigit = parseInt(fractionalPart[2], 10);
      let cents = parseInt(fractionalPart.slice(0, 2), 10);
      if (thirdDigit >= 5) {
        cents += 1;
      }
      fractionalPart = cents.toString().padStart(2, '0');
    }

    const cents = parseInt(wholePart, 10) * 100 + parseInt(fractionalPart, 10);
    return isNegative ? -cents : cents;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create Initial Hydration Service
 *
 * Factory function for creating the hydration service.
 *
 * @param database - WatermelonDB database instance
 * @param supabase - Supabase client instance
 * @returns IInitialHydrationService implementation
 *
 * @example
 * ```typescript
 * const hydrationService = createInitialHydrationService(database, supabase);
 *
 * if (await hydrationService.isHydrationNeeded()) {
 *   const result = await hydrationService.hydrate(userId);
 *   console.log('Hydration result:', result);
 * }
 * ```
 */
export function createInitialHydrationService(
  database: WatermelonDatabase,
  supabase: SupabaseClient<SupabaseDatabase>
): IInitialHydrationService {
  return new InitialHydrationService(database, supabase);
}
