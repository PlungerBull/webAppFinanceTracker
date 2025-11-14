import { createClient } from '@/lib/supabase/client';
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
      console.error('Error fetching account currencies:', error);
      throw new Error(error.message || 'Failed to fetch account currencies');
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
      console.error('Error creating account currency:', error);
      throw new Error(error.message || 'Failed to add currency to account');
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
      console.error('Error updating account currency:', error);
      throw new Error(error.message || 'Failed to update account currency');
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
      console.error('Error deleting account currency:', error);
      throw new Error(error.message || 'Failed to remove currency from account');
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
      console.error('Error creating account currencies:', error);
      throw new Error(error.message || 'Failed to add currencies to account');
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

    // Get user for authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // First, update all transactions with the old currency to the new currency
    const { error: transactionsError } = await supabase
      .from('transactions')
      .update({ currency_original: newCurrencyCode })
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .eq('currency_original', oldCurrencyCode);

    if (transactionsError) {
      console.error('Error updating transactions:', transactionsError);
      throw new Error('Failed to update transactions with new currency');
    }

    // Then, update or create the account_currencies record
    // First try to find the old currency record
    const { data: oldCurrency } = await supabase
      .from('account_currencies')
      .select('id')
      .eq('account_id', accountId)
      .eq('currency_code', oldCurrencyCode)
      .single();

    if (oldCurrency) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('account_currencies')
        .update({
          currency_code: newCurrencyCode,
          starting_balance: newStartingBalance,
        })
        .eq('id', oldCurrency.id);

      if (updateError) {
        console.error('Error updating account currency:', updateError);
        throw new Error('Failed to update account currency');
      }
    } else {
      // Create new record if it doesn't exist
      const { error: createError } = await supabase
        .from('account_currencies')
        .insert({
          account_id: accountId,
          currency_code: newCurrencyCode,
          starting_balance: newStartingBalance,
        });

      if (createError) {
        console.error('Error creating account currency:', createError);
        throw new Error('Failed to create account currency');
      }
    }
  },
};
