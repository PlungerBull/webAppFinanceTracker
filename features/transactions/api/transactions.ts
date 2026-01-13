/**
 * DEPRECATED: Old Transactions API (Direct Supabase Calls)
 *
 * ⚠️ WARNING: This file is DEPRECATED and scheduled for removal.
 *
 * DO NOT USE IN NEW CODE. Use the Repository Pattern instead:
 * - Import hooks from: @/features/transactions/hooks
 * - Use: useTransactions(), useAddTransaction(), useUpdateTransaction(), etc.
 *
 * Why deprecated:
 * 1. Violates Repository Pattern architecture
 * 2. Direct Supabase calls prevent platform independence (iOS can't use this)
 * 3. No type safety with DataResult pattern
 * 4. Missing business logic (retry on conflict, auth extraction)
 * 5. Not compatible with offline-first sync architecture
 *
 * Migration Guide:
 * OLD: const { data } = await transactionsApi.getAllPaginated(filters, pagination)
 * NEW: const { data } = useTransactions(filters)  // Hook handles pagination automatically
 *
 * OLD: await transactionsApi.create(data)
 * NEW: const { mutate } = useAddTransaction(); mutate(data);
 *
 * See: AI_CONTEXT.md section 4H for full Repository Pattern guide
 *
 * @deprecated Use hooks from @/features/transactions/hooks instead
 */

import { createClient } from '@/lib/supabase/client';
import { TRANSACTIONS } from '@/lib/constants';
import type {
  CreateTransactionFormData,
  CreateTransactionLedgerData,
  UpdateTransactionFormData
} from '../schemas/transaction.schema';
import type { Transaction } from '@/types/domain';
import type { TransactionViewEntity } from '../domain';

// For backward compatibility in this deprecated file
type TransactionView = TransactionViewEntity;
import {
  dbTransactionViewToDomain,
  dbTransactionViewsToDomain,
  dbTransactionToDomain,
  domainTransactionToDbUpdate,
} from '@/lib/types/data-transformers';
import { applyTransactionFilters, type TransactionFilters } from './filters';

/**
 * @deprecated Use hooks from @/features/transactions/hooks instead
 * This API object is kept for backward compatibility only.
 */
export const transactionsApi = {
  // Get all transactions with pagination for infinite scroll
  getAllPaginated: async (
    filters?: TransactionFilters,
    pagination?: {
      offset: number;
      limit: number;
    }
  ): Promise<{ data: any[]; count: number | null }> => {
    const supabase = createClient();
    const { offset = 0, limit = 50 } = pagination || {};
    const sortBy = filters?.sortBy || 'date'; // Default to Financial Ledger

    let query = supabase
      .from('transactions_view')
      .select('*', { count: 'exact' })
      // Primary sort by selected field (date or created_at)
      .order(
        sortBy === 'date' ? 'date' : 'created_at',
        { ascending: false }
      )
      // Tie-breaker: Always add created_at DESC for deterministic ordering
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply all standard filters (centralized)
    query = applyTransactionFilters(query, filters);

    const { data, error, count } = await query;

    if (error) {
      console.error(TRANSACTIONS.API.CONSOLE.FETCH_TRANSACTIONS, error);
      throw new Error(error.message || TRANSACTIONS.API.ERRORS.FETCH_ALL_FAILED);
    }

    return {
      data: data ? dbTransactionViewsToDomain(data) : [],
      count,
    };
  },

  // Get a single transaction by ID (RLS handles user filtering)
  getById: async (id: string): Promise<any> => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('transactions_view')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error(TRANSACTIONS.API.CONSOLE.FETCH_TRANSACTION, error);
      throw new Error(error.message || TRANSACTIONS.API.ERRORS.FETCH_ONE_FAILED);
    }

    // Transform snake_case to camelCase before returning to frontend
    return dbTransactionViewToDomain(data);
  },

  // Create a new transaction in the ledger
  // IMPORTANT: This function requires COMPLETE data that matches database constraints.
  // Use CreateTransactionLedgerData type - TypeScript enforces required fields at compile time.
  // For incomplete/draft transactions, route to the inbox instead.
  create: async (transactionData: CreateTransactionLedgerData): Promise<any> => {
    const supabase = createClient();

    // Get user for user_id (no DB default exists yet)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error(TRANSACTIONS.API.ERRORS.USER_NOT_AUTHENTICATED);
    }

    // Generate client-side UUID for optimistic updates
    // This allows UI to render the new transaction immediately with a real ID
    const clientId = crypto.randomUUID();

    // TypeScript guarantees these fields are present due to CreateTransactionLedgerData type
    // No runtime checks needed - compilation will fail if required fields are missing
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        id: clientId, // NEW: Client-provided ID for optimistic updates
        user_id: user.id,
        description: transactionData.description || null,
        amount_original: transactionData.amount_original,
        // ✅ SACRED LEDGER: amount_home is system-managed (DEFAULT 0, trigger overwrites)
        // Field is OMITTED - calculate_amount_home trigger sets correct value before INSERT completes
        date: transactionData.date,
        category_id: transactionData.category_id || null,
        account_id: transactionData.account_id, // ✅ Guaranteed non-null by type
        // ✅ SACRED LEDGER: currency_original is system-managed (DEFAULT 'PENDING', trigger overwrites)
        // Field is OMITTED - enforce_sacred_ledger_currency trigger sets correct value before INSERT completes
        exchange_rate: transactionData.exchange_rate,
        notes: transactionData.notes || null, // ✅ Capture notes
        // version defaults to 1 (database DEFAULT)
      })
      .select()
      .single();

    if (error) {
      console.error(TRANSACTIONS.API.CONSOLE.CREATE_TRANSACTION, error);
      throw new Error(error.message || TRANSACTIONS.API.ERRORS.CREATE_FAILED);
    }

    // Write-then-Read: Fetch from view to get complete data with currency
    // Raw table row lacks currency_original - must query transactions_view for complete object
    return transactionsApi.getById(data.id);
  },

  // Update an existing transaction with version checking
  // Returns { data, conflict } to allow caller to handle version conflicts
  update: async (
    id: string,
    transactionData: UpdateTransactionFormData
  ): Promise<{ data: TransactionView | null; conflict: boolean }> => {
    const supabase = createClient();

    // Use version-checked RPC instead of direct UPDATE
    const { data, error } = await supabase.rpc('update_transaction_with_version', {
      p_transaction_id: id,
      p_expected_version: transactionData.version,
      p_updates: {
        description: transactionData.description,
        amountOriginal: transactionData.amount_original,
        accountId: transactionData.account_id,
        categoryId: transactionData.category_id,
        date: transactionData.date,
        notes: transactionData.notes,
        exchangeRate: transactionData.exchange_rate,
      },
    });

    if (error) {
      console.error(TRANSACTIONS.API.CONSOLE.UPDATE_TRANSACTION, error);
      throw new Error(error.message || TRANSACTIONS.API.ERRORS.UPDATE_FAILED);
    }

    const result = data as { success: boolean; error?: string; newVersion?: number };

    // Version conflict detected
    if (!result.success && result.error === 'version_conflict') {
      return { data: null, conflict: true };
    }

    // Other error (not_found, concurrent_modification)
    if (!result.success) {
      throw new Error(result.error || TRANSACTIONS.API.ERRORS.UPDATE_FAILED);
    }

    // Success - fetch updated transaction
    const updated = await transactionsApi.getById(id);
    return { data: updated, conflict: false };
  },

  // Batch update transaction fields (used by unified detail panel)
  // Accepts EditedFields from the panel and transforms to database format
  // NEW: Requires version for optimistic concurrency control
  updateBatch: async (
    id: string,
    updates: {
      description?: string;
      amountOriginal?: number;
      accountId?: string;
      categoryId?: string;
      date?: string;
      notes?: string;
      exchangeRate?: number;
    },
    version: number
  ): Promise<{ data: TransactionView | null; conflict: boolean }> => {
    const supabase = createClient();

    // Use version-checked RPC (same as regular update)
    const { data, error } = await supabase.rpc('update_transaction_with_version', {
      p_transaction_id: id,
      p_expected_version: version,
      p_updates: {
        description: updates.description,
        amountOriginal: updates.amountOriginal,
        accountId: updates.accountId,
        categoryId: updates.categoryId,
        date: updates.date,
        notes: updates.notes,
        exchangeRate: updates.exchangeRate,
      },
    });

    if (error) {
      console.error(TRANSACTIONS.API.CONSOLE.UPDATE_TRANSACTION, error);
      throw new Error(error.message || TRANSACTIONS.API.ERRORS.UPDATE_FAILED);
    }

    const result = data as { success: boolean; error?: string; newVersion?: number };

    // Version conflict detected
    if (!result.success && result.error === 'version_conflict') {
      return { data: null, conflict: true };
    }

    // Other error
    if (!result.success) {
      throw new Error(result.error || TRANSACTIONS.API.ERRORS.UPDATE_FAILED);
    }

    // Success - fetch updated transaction
    const updated = await transactionsApi.getById(id);
    return { data: updated, conflict: false };
  },

  // Delete a transaction with version checking (CTO Refinement #3)
  // Prevents accidental deletion of modified transactions
  delete: async (id: string, version: number): Promise<{ success: boolean; conflict: boolean; currentData?: any }> => {
    const supabase = createClient();

    // Use version-checked delete RPC
    const { data, error } = await supabase.rpc('delete_transaction_with_version', {
      p_transaction_id: id,
      p_expected_version: version,
    });

    if (error) {
      console.error(TRANSACTIONS.API.CONSOLE.DELETE_TRANSACTION, error);
      throw new Error(error.message || TRANSACTIONS.API.ERRORS.DELETE_FAILED);
    }

    const result = data as { success: boolean; error?: string; currentData?: any; message?: string };

    // Version conflict - transaction was modified
    if (!result.success && result.error === 'version_conflict') {
      return { success: false, conflict: true, currentData: result.currentData };
    }

    // Other error
    if (!result.success) {
      throw new Error(result.error || TRANSACTIONS.API.ERRORS.DELETE_FAILED);
    }

    return { success: true, conflict: false };
  },

  // Bulk update multiple transactions with version checking
  // Uses RPC function for atomic operation with validation
  // NEW: Requires versions array (parallel to transactionIds)
  bulkUpdate: async (
    transactionIds: string[],
    versions: number[], // NEW: Version array for optimistic locking
    updates: {
      categoryId?: string;
      accountId?: string;
      date?: string;
      notes?: string;
    }
  ): Promise<{
    success: boolean;
    successCount: number;
    errorCount: number;
    updatedIds: string[];
    errors: Array<{ transactionId: string; error: string; conflict?: boolean }>;
  }> => {
    const supabase = createClient();

    // Transform camelCase to RPC JSON format (stays camelCase for JSON)
    const rpcUpdates: Record<string, unknown> = {};
    if (updates.categoryId !== undefined) rpcUpdates.categoryId = updates.categoryId;
    if (updates.accountId !== undefined) rpcUpdates.accountId = updates.accountId;
    if (updates.date !== undefined) rpcUpdates.date = updates.date;
    if (updates.notes !== undefined) rpcUpdates.notes = updates.notes;

    const { data, error } = await supabase.rpc('bulk_update_transactions', {
      p_transaction_ids: transactionIds,
      p_versions: versions, // NEW: Pass versions array
      p_updates: rpcUpdates as any, // Cast to any since JSONB type is complex
    });

    if (error || !data) {
      console.error('Bulk update failed:', error);
      throw new Error(error?.message || 'Failed to update transactions');
    }

    // Cast data as our expected response type (JSONB from Postgres)
    const result = data as unknown as {
      success: boolean;
      successCount: number;
      errorCount: number;
      updatedIds: string[];
      errors: Array<{ transactionId: string; error: string; conflict?: boolean }>;
    };

    return result;
  },

  // Get category counts for filtered transactions (server-side aggregation)
  // Used for filter dropdown to show accurate counts even with pagination
  getCategoryCounts: async (filters?: TransactionFilters): Promise<Record<string, number>> => {
    const supabase = createClient();

    // Build query with same filters as main query
    let query = supabase
      .from('transactions_view')
      .select('category_id');

    // Apply standard filters (centralized)
    query = applyTransactionFilters(query, filters);

    const { data, error } = await query;

    if (error) {
      console.error(TRANSACTIONS.API.CONSOLE.FETCH_TRANSACTIONS, error);
      throw new Error(error.message || TRANSACTIONS.API.ERRORS.FETCH_ALL_FAILED);
    }

    // Count transactions per category
    const counts: Record<string, number> = {};
    data?.forEach((row) => {
      const categoryId = row.category_id;
      if (categoryId) {
        counts[categoryId] = (counts[categoryId] || 0) + 1;
      }
    });

    return counts;
  },
};