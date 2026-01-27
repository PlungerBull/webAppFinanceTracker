/**
 * Supabase Account Repository Implementation
 *
 * Implements IAccountRepository using Supabase as the data store.
 *
 * CTO MANDATES:
 * - Floating-point safe cents conversion (string-based)
 * - DataResult pattern (never throws)
 * - RLS enforcement via user_id in all queries
 *
 * @module supabase-account-repository
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import type { IAccountRepository } from './account-repository.interface';
import type {
  AccountDataResult,
  CreateAccountDTO,
  UpdateAccountDTO,
  CreateAccountGroupResult,
  AccountFilters,
  AccountViewEntity,
} from '../domain';
import {
  AccountNotFoundError,
  AccountRepositoryError,
  AccountValidationError,
  AccountLockedError,
  AccountVersionConflictError,
} from '../domain';

// Database row type from bank_accounts with joined global_currencies
type DbAccountRow = Database['public']['Tables']['bank_accounts']['Row'] & {
  global_currencies: { symbol: string } | null;
};

/**
 * Supabase Account Repository
 *
 * Handles all database operations for accounts.
 */
export class SupabaseAccountRepository implements IAccountRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  /**
   * Convert decimal to integer cents (floating-point safe)
   *
   * CTO Mandate: TRUE string-based parsing - NO binary float multiplication.
   * Binary float: 1.15 * 100 can yield 114.99999999999999
   *
   * This implementation splits the string at the decimal point and
   * performs pure integer arithmetic to avoid IEEE 754 precision errors.
   */
  private toCents(decimal: number | string | null): number {
    if (decimal === null || decimal === undefined) {
      return 0;
    }

    // Convert to string for parsing
    const str = typeof decimal === 'string' ? decimal : decimal.toString();

    // Handle negative numbers
    const isNegative = str.startsWith('-');
    const absStr = isNegative ? str.slice(1) : str;

    // Split at decimal point
    const parts = absStr.split('.');
    const wholePart = parts[0] || '0';
    let fractionalPart = parts[1] || '00';

    // Normalize fractional part to exactly 2 digits
    // "5" -> "50", "123" -> "12" (truncate beyond cents)
    if (fractionalPart.length === 1) {
      fractionalPart = fractionalPart + '0';
    } else if (fractionalPart.length > 2) {
      // Round the third digit
      const thirdDigit = parseInt(fractionalPart[2], 10);
      let cents = parseInt(fractionalPart.slice(0, 2), 10);
      if (thirdDigit >= 5) {
        cents += 1;
      }
      fractionalPart = cents.toString().padStart(2, '0');
    }

    // Pure integer arithmetic: whole dollars * 100 + cents
    const cents = parseInt(wholePart, 10) * 100 + parseInt(fractionalPart, 10);

    return isNegative ? -cents : cents;
  }

  /**
   * Convert integer cents to decimal dollars
   */
  private fromCents(cents: number): number {
    return cents / 100;
  }

  /**
   * Transform database row to domain entity
   */
  private dbAccountToEntity(dbRow: DbAccountRow): AccountViewEntity {
    // Type assertion for sync fields added by migration 20260126000000
    const syncRow = dbRow as DbAccountRow & {
      version?: number;
      deleted_at?: string | null;
    };

    return {
      id: dbRow.id,
      version: syncRow.version ?? 1,
      userId: dbRow.user_id,
      groupId: dbRow.group_id,
      name: dbRow.name,
      type: dbRow.type as AccountViewEntity['type'],
      currencyCode: dbRow.currency_code,
      color: dbRow.color,
      currentBalanceCents: this.toCents(dbRow.current_balance),
      isVisible: dbRow.is_visible,
      createdAt: dbRow.created_at,
      updatedAt: dbRow.updated_at,
      deletedAt: syncRow.deleted_at ?? null,
      currencySymbol: dbRow.global_currencies?.symbol ?? '',
    };
  }

  async getAll(
    userId: string,
    filters?: AccountFilters
  ): Promise<AccountDataResult<AccountViewEntity[]>> {
    try {
      let query = this.supabase
        .from('bank_accounts')
        .select(
          `
          *,
          global_currencies(symbol)
        `
        )
        .eq('user_id', userId)
        .order('name', { ascending: true });

      // Apply filters
      if (filters?.type) {
        query = query.eq('type', filters.type);
      }
      if (filters?.isVisible !== undefined) {
        query = query.eq('is_visible', filters.isVisible);
      }
      if (filters?.groupId) {
        query = query.eq('group_id', filters.groupId);
      }

      // Tombstone filtering: Only show active accounts unless includeDeleted is set
      if (!filters?.includeDeleted) {
        query = query.is('deleted_at', null);
      }

      const { data, error } = await query;

      if (error) {
        return {
          success: false,
          data: null,
          error: new AccountRepositoryError(
            `Failed to fetch accounts: ${error.message}`,
            error
          ),
        };
      }

      const entities = (data ?? []).map((row) =>
        this.dbAccountToEntity(row as DbAccountRow)
      );

      return { success: true, data: entities };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new AccountRepositoryError(
          `Unexpected error fetching accounts: ${(err as Error).message}`,
          err
        ),
      };
    }
  }

  async getById(
    userId: string,
    id: string
  ): Promise<AccountDataResult<AccountViewEntity>> {
    try {
      const { data, error } = await this.supabase
        .from('bank_accounts')
        .select(
          `
          *,
          global_currencies(symbol)
        `
        )
        .eq('id', id)
        .eq('user_id', userId)
        .is('deleted_at', null) // Tombstone filter: Only return active accounts
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            success: false,
            data: null,
            error: new AccountNotFoundError(id),
          };
        }
        return {
          success: false,
          data: null,
          error: new AccountRepositoryError(
            `Failed to fetch account: ${error.message}`,
            error
          ),
        };
      }

      const entity = this.dbAccountToEntity(data as DbAccountRow);

      return { success: true, data: entity };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new AccountRepositoryError(
          `Unexpected error fetching account: ${(err as Error).message}`,
          err
        ),
      };
    }
  }

  async getByGroupId(
    userId: string,
    groupId: string
  ): Promise<AccountDataResult<AccountViewEntity[]>> {
    return this.getAll(userId, { groupId });
  }

  async createWithCurrencies(
    userId: string,
    data: CreateAccountDTO
  ): Promise<AccountDataResult<CreateAccountGroupResult>> {
    try {
      // Validate input
      if (!data.currencies || data.currencies.length === 0) {
        return {
          success: false,
          data: null,
          error: new AccountValidationError(
            'At least one currency is required',
            'currencies'
          ),
        };
      }

      // Call RPC for atomic multi-account creation
      const { data: rpcResult, error: rpcError } = await this.supabase.rpc(
        'create_account_group',
        {
          p_user_id: userId,
          p_name: data.name,
          p_color: data.color,
          p_type: data.type,
          p_currencies: data.currencies,
        }
      );

      if (rpcError) {
        return {
          success: false,
          data: null,
          error: new AccountRepositoryError(
            `Failed to create account group: ${rpcError.message}`,
            rpcError
          ),
        };
      }

      // RPC returns { group_id: string, accounts: [...] }
      const result = rpcResult as {
        group_id: string;
        accounts: Array<{
          id: string;
          currency_code: string;
        }>;
      };

      // Fetch the created accounts to get full entity data
      const accountsResult = await this.getByGroupId(userId, result.group_id);

      if (!accountsResult.success) {
        return {
          success: false,
          data: null,
          error: accountsResult.error,
        };
      }

      return {
        success: true,
        data: {
          groupId: result.group_id,
          accounts: accountsResult.data,
        },
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new AccountRepositoryError(
          `Unexpected error creating account: ${(err as Error).message}`,
          err
        ),
      };
    }
  }

  async update(
    userId: string,
    id: string,
    data: UpdateAccountDTO
  ): Promise<AccountDataResult<AccountViewEntity>> {
    try {
      // CTO Mandate: Use version-checked RPC for optimistic concurrency control
      const { data: rpcResult, error: rpcError } = await this.supabase.rpc(
        'update_account_with_version',
        {
          p_account_id: id,
          p_expected_version: data.version,
          p_name: data.name ?? undefined,
          p_color: data.color ?? undefined,
          p_is_visible: data.isVisible ?? undefined,
        }
      );

      if (rpcError) {
        return {
          success: false,
          data: null,
          error: new AccountRepositoryError(
            `Failed to update account: ${rpcError.message}`,
            rpcError
          ),
        };
      }

      // Parse RPC response
      const result = rpcResult as {
        success: boolean;
        error?: string;
        expectedVersion?: number;
        currentVersion?: number;
      };

      if (!result.success) {
        // Handle version conflict
        if (result.error === 'version_conflict') {
          return {
            success: false,
            data: null,
            error: new AccountVersionConflictError(id, data.version),
            conflict: true,
          };
        }

        // Handle not found
        if (result.error === 'not_found') {
          return {
            success: false,
            data: null,
            error: new AccountNotFoundError(id),
          };
        }

        // Handle concurrent modification
        if (result.error === 'concurrent_modification') {
          return {
            success: false,
            data: null,
            error: new AccountVersionConflictError(id, data.version),
            conflict: true,
          };
        }

        // Generic error
        return {
          success: false,
          data: null,
          error: new AccountRepositoryError(
            `Failed to update account: ${result.error}`
          ),
        };
      }

      // Fetch the updated account to return full entity
      return this.getById(userId, id);
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new AccountRepositoryError(
          `Unexpected error updating account: ${(err as Error).message}`,
          err
        ),
      };
    }
  }

  async delete(
    userId: string,
    id: string,
    version: number
  ): Promise<AccountDataResult<void>> {
    try {
      // CTO Mandate: Use version-checked soft delete RPC (Tombstone Pattern)
      const { data: rpcResult, error: rpcError } = await this.supabase.rpc(
        'delete_account_with_version',
        {
          p_account_id: id,
          p_expected_version: version,
        }
      );

      if (rpcError) {
        // Check for SQLSTATE codes for backward compatibility
        const pgError = rpcError as { code?: string };

        // 23503 = foreign_key_violation (FK constraint prevents delete)
        if (pgError.code === '23503') {
          return {
            success: false,
            data: null,
            error: new AccountLockedError(id, 'foreign_key'),
          };
        }

        // P0001 = raise_exception
        if (pgError.code === 'P0001') {
          return {
            success: false,
            data: null,
            error: new AccountLockedError(id, 'reconciled'),
          };
        }

        return {
          success: false,
          data: null,
          error: new AccountRepositoryError(
            `Failed to delete account: ${rpcError.message}`,
            rpcError
          ),
        };
      }

      // Parse RPC response
      const result = rpcResult as {
        success: boolean;
        error?: string;
        expectedVersion?: number;
        currentVersion?: number;
      };

      if (!result.success) {
        // Handle version conflict
        if (result.error === 'version_conflict') {
          return {
            success: false,
            data: null,
            error: new AccountVersionConflictError(id, version),
            conflict: true,
          };
        }

        // Handle not found
        if (result.error === 'not_found') {
          return {
            success: false,
            data: null,
            error: new AccountNotFoundError(id),
          };
        }

        // Handle concurrent modification
        if (result.error === 'concurrent_modification') {
          return {
            success: false,
            data: null,
            error: new AccountVersionConflictError(id, version),
            conflict: true,
          };
        }

        // Generic error
        return {
          success: false,
          data: null,
          error: new AccountRepositoryError(
            `Failed to delete account: ${result.error}`
          ),
        };
      }

      return { success: true, data: undefined };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new AccountRepositoryError(
          `Unexpected error deleting account: ${(err as Error).message}`,
          err
        ),
      };
    }
  }
}
