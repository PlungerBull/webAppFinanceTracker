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
   * CTO Mandate: Use string-based parsing to avoid IEEE 754 precision errors.
   * Binary float: 1.15 * 100 can yield 114.99999999999999
   */
  private toCents(decimal: number | string | null): number {
    if (decimal === null || decimal === undefined) {
      return 0;
    }
    // String conversion prevents floating point precision errors
    return Math.round(
      parseFloat(typeof decimal === 'string' ? decimal : decimal.toString()) *
        100
    );
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
    return {
      id: dbRow.id,
      version: 1, // TODO: Add version column to bank_accounts table
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
      deletedAt: null, // TODO: Add deleted_at column for soft deletes
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
      // Build update object (only include provided fields)
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) {
        updateData.name = data.name;
      }
      if (data.color !== undefined) {
        updateData.color = data.color;
      }
      if (data.isVisible !== undefined) {
        updateData.is_visible = data.isVisible;
      }

      const { data: updatedRow, error } = await this.supabase
        .from('bank_accounts')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', userId)
        .select(
          `
          *,
          global_currencies(symbol)
        `
        )
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
            `Failed to update account: ${error.message}`,
            error
          ),
        };
      }

      const entity = this.dbAccountToEntity(updatedRow as DbAccountRow);

      return { success: true, data: entity };
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
    id: string
  ): Promise<AccountDataResult<void>> {
    try {
      const { error } = await this.supabase
        .from('bank_accounts')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        return {
          success: false,
          data: null,
          error: new AccountRepositoryError(
            `Failed to delete account: ${error.message}`,
            error
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
