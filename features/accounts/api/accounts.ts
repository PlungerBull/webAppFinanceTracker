import { createClient } from '@/lib/supabase/client';
import { ACCOUNTS } from '@/lib/constants';
import type { Database } from '@/types/database.types';
import type { UpdateAccountFormData } from '../schemas/account.schema';
import {
  dbAccountBalancesToDomain,
  dbAccountToDomain,
} from '@/lib/types/data-transformers';

export const accountsApi = {
  /**
   * Get all accounts for the current user with live ledger balances.
   * REFACTORED: Now queries 'bank_accounts' directly for O(1) performance.
   */
  getAll: async () => {
    const supabase = createClient();

    // Changed from 'account_balances' to 'bank_accounts'
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error(`${ACCOUNTS.CONSOLE.ERROR_PREFIX} ${ACCOUNTS.CONSOLE.FETCH_ACCOUNTS}: `, error);
      throw new Error(error.message || ACCOUNTS.MESSAGES.ERROR.FETCH_FAILED);
    }

    // Transform bank_accounts to account balance format (with current_balance from table)
    return data ? data.map(account => ({
      accountId: account.id,
      groupId: account.group_id,
      name: account.name,
      currencyCode: account.currency_code,
      type: account.type,
      currentBalance: account.current_balance,
    })) : [];
  },

  /**
   * Get a single account by ID
   */
  getById: async (id: string) => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error(`${ACCOUNTS.CONSOLE.ERROR_PREFIX} ${ACCOUNTS.CONSOLE.FETCH_ACCOUNT}: `, error);
      throw new Error(error.message || ACCOUNTS.MESSAGES.ERROR.FETCH_ONE_FAILED);
    }

    // Transform snake_case to camelCase before returning to frontend
    return dbAccountToDomain(data);
  },

  /**
   * Create a new account group with multiple currencies atomically
   * NEW CONTAINER PATTERN: Each currency creates a separate account row with the same group_id
   * Uses database function to ensure all-or-nothing creation
   *
   * NOTE: Returns raw JSON from database function (not transformed).
   * This is acceptable as the return value is typically not used by consumers.
   * If you need the account data, use getById() after creation instead.
   */
  createWithCurrencies: async (
    accountName: string,
    accountColor: string,
    accountType: 'checking' | 'savings' | 'credit_card' | 'investment' | 'loan' | 'cash' | 'other',
    currencies: string[] // NEW: Just an array of currency codes (no starting balances)
  ) => {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error(ACCOUNTS.MESSAGES.ERROR.USER_NOT_AUTHENTICATED);

    // Database function handles authentication and creates multiple account rows
    const { data, error } = await supabase.rpc('create_account_group', {
      p_user_id: user.id,
      p_name: accountName,
      p_color: accountColor,
      p_type: accountType,
      p_currencies: currencies, // Array of currency codes like ["USD", "PEN"]
    });

    if (error) {
      console.error(`${ACCOUNTS.CONSOLE.ERROR_PREFIX} ${ACCOUNTS.CONSOLE.CREATE_ACCOUNT}: `, error);
      throw new Error(error.message || ACCOUNTS.MESSAGES.ERROR.CREATE_FAILED);
    }

    // Returns raw JSON from database function with group_id
    return data;
  },

  /**
   * Update an account
   */
  update: async (id: string, accountData: UpdateAccountFormData) => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('bank_accounts')
      .update(accountData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`${ACCOUNTS.CONSOLE.ERROR_PREFIX} ${ACCOUNTS.CONSOLE.UPDATE_ACCOUNT}: `, error);
      throw new Error(error.message || ACCOUNTS.MESSAGES.ERROR.UPDATE_FAILED);
    }

    // Transform snake_case to camelCase before returning to frontend
    return dbAccountToDomain(data);
  },

  /**
   * Delete an account
   */
  delete: async (id: string) => {
    const supabase = createClient();

    const { error } = await supabase
      .from('bank_accounts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`${ACCOUNTS.CONSOLE.ERROR_PREFIX} ${ACCOUNTS.CONSOLE.DELETE_ACCOUNT}: `, error);
      throw new Error(error.message || ACCOUNTS.MESSAGES.ERROR.DELETE_FAILED);
    }
  },
};