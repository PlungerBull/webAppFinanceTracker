import { createClient } from '@/lib/supabase/client';
import type { CreateAccountFormData, UpdateAccountFormData } from '../schemas/account.schema';

export const accountsApi = {
  /**
   * Get all accounts for the current user with current balances
   */
  getAll: async () => {
    const supabase = createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('account_balances')
      .select('*')
      .eq('user_id', user.id)
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
   * Create a new account
   */
  create: async (accountData: CreateAccountFormData) => {
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('bank_accounts')
      .insert({
        user_id: user.id,
        name: accountData.name,
        starting_balance: accountData.starting_balance,
        currency: accountData.currency,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating account:', error);
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
