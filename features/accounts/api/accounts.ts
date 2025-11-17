import { createClient } from '@/lib/supabase/client';
import type { UpdateAccountFormData } from '../schemas/account.schema';

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
      console.error('Error fetching accounts:', error);
      throw new Error(error.message || 'Failed to fetch accounts');
    }

    return data;
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
      console.error('Error fetching account:', error);
      throw new Error(error.message || 'Failed to fetch account');
    }

    return data;
  },

  /**
   * Create a new account with currencies atomically
   * Uses database function to ensure all-or-nothing creation
   * Authentication is handled by the database function via auth.uid()
   */
  createWithCurrencies: async (
    accountName: string,
    currencies: Array<{ code: string; starting_balance: number }>
  ) => {
    const supabase = createClient();

    // Database function handles authentication via auth.uid()
    const { data, error } = await supabase.rpc('create_account_with_currencies', {
      p_account_name: accountName,
      p_currencies: currencies,
    });

    if (error) {
      console.error('Error creating account with currencies:', error);
      throw new Error(error.message || 'Failed to create account');
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
      console.error('Error updating account:', error);
      throw new Error(error.message || 'Failed to update account');
    }

    return data;
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
      console.error('Error deleting account:', error);
      throw new Error(error.message || 'Failed to delete account');
    }
  },
};