import { createClient } from '@/lib/supabase/client';
import { ACCOUNTS } from '@/lib/constants';
import type { Database } from '@/types/database.types';

type AccountCurrency = Database['public']['Tables']['account_currencies']['Row'];
type AccountCurrencyInsert = Database['public']['Tables']['account_currencies']['Insert'];
type AccountCurrencyUpdate = Database['public']['Tables']['account_currencies']['Update'];

export const accountCurrenciesApi = {
  /**
   * Get all currencies for a specific account
   */
  getByAccountId: async (accountId: string): Promise<AccountCurrency[]> => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('account_currencies')
      .select('*')
      .eq('account_id', accountId)
      .order('currency_code', { ascending: true });

    if (error) {
      console.error(`${ACCOUNTS.CONSOLE.ERROR_PREFIX} ${ACCOUNTS.CONSOLE.FETCH_CURRENCIES}:`, error);
      throw new Error(error.message || ACCOUNTS.MESSAGES.ERROR.CURRENCY_FETCH_FAILED);
    }

    return data;
  },

  /**
   * Add a currency to an account
   */
  create: async (accountCurrency: AccountCurrencyInsert): Promise<AccountCurrency> => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('account_currencies')
      .insert(accountCurrency)
      .select()
      .single();

    if (error) {
      console.error(`${ACCOUNTS.CONSOLE.ERROR_PREFIX} ${ACCOUNTS.CONSOLE.CREATE_CURRENCY}:`, error);
      throw new Error(error.message || ACCOUNTS.MESSAGES.ERROR.CURRENCY_ADD_FAILED);
    }

    return data;
  },

  /**
   * Update a currency's starting balance
   */
  update: async (id: string, updates: AccountCurrencyUpdate): Promise<AccountCurrency> => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('account_currencies')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`${ACCOUNTS.CONSOLE.ERROR_PREFIX} ${ACCOUNTS.CONSOLE.UPDATE_CURRENCY}:`, error);
      throw new Error(error.message || ACCOUNTS.MESSAGES.ERROR.CURRENCY_UPDATE_FAILED);
    }

    return data;
  },

  /**
   * Remove a currency from an account
   */
  delete: async (id: string): Promise<void> => {
    const supabase = createClient();

    const { error } = await supabase
      .from('account_currencies')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`${ACCOUNTS.CONSOLE.ERROR_PREFIX} ${ACCOUNTS.CONSOLE.DELETE_CURRENCY}:`, error);
      throw new Error(error.message || ACCOUNTS.MESSAGES.ERROR.CURRENCY_REMOVE_FAILED);
    }
  },

  /**
   * Create multiple currencies for an account at once
   */
  createMany: async (accountCurrencies: AccountCurrencyInsert[]): Promise<AccountCurrency[]> => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('account_currencies')
      .insert(accountCurrencies)
      .select();

    if (error) {
      console.error(`${ACCOUNTS.CONSOLE.ERROR_PREFIX} ${ACCOUNTS.CONSOLE.CREATE_CURRENCY}:`, error);
      throw new Error(error.message || ACCOUNTS.MESSAGES.ERROR.CURRENCY_BULK_ADD_FAILED);
    }

    return data;
  },

  /**
   * Replace a currency in an account (updates account_currencies and all related transactions)
   */
  replaceCurrency: async (
    accountId: string,
    oldCurrencyCode: string,
    newCurrencyCode: string,
    newStartingBalance: number
  ): Promise<void> => {
    const supabase = createClient();

    // Call our new database function!
    const { error } = await supabase.rpc('replace_account_currency', {
      p_account_id: accountId,
      p_old_currency_code: oldCurrencyCode,
      p_new_currency_code: newCurrencyCode,
      p_new_starting_balance: newStartingBalance,
    });

    if (error) {
      console.error(`${ACCOUNTS.CONSOLE.ERROR_PREFIX} ${ACCOUNTS.CONSOLE.REPLACE_CURRENCY}:`, error);
      throw new Error(`${ACCOUNTS.MESSAGES.ERROR.CURRENCY_REPLACE_FAILED}: ${error.message}`);
    }
  },
};
