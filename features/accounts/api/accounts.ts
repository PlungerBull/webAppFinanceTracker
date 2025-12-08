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
   * Get all accounts for the current user with current balances (RLS handles user filtering)
   */
  getAll: async () => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('account_balances')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error(`${ACCOUNTS.CONSOLE.ERROR_PREFIX} ${ACCOUNTS.CONSOLE.FETCH_ACCOUNTS}: `, error);
      throw new Error(error.message || ACCOUNTS.MESSAGES.ERROR.FETCH_FAILED);
    }

    // Transform snake_case to camelCase before returning to frontend
    return data ? dbAccountBalancesToDomain(data) : [];
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
   * Create a new account with currencies atomically
   * Uses database function to ensure all-or-nothing creation
   * Authentication is handled by the database function via auth.uid()
   */
  createWithCurrencies: async (
    accountName: string,
    accountColor: string,
    currencies: Array<{ code: string; starting_balance: number }>
  ) => {
    const supabase = createClient();

    // Database function handles authentication via auth.uid()
    const { data, error } = await supabase.rpc('create_account_with_currencies', {
      p_account_name: accountName,
      p_account_color: accountColor,
      p_currencies: currencies,
    });

    if (error) {
      console.error(`${ACCOUNTS.CONSOLE.ERROR_PREFIX} ${ACCOUNTS.CONSOLE.CREATE_ACCOUNT}: `, error);
      throw new Error(error.message || ACCOUNTS.MESSAGES.ERROR.CREATE_FAILED);
    }

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