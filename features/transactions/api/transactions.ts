import { createClient } from '@/lib/supabase/client';
import type { CreateTransactionFormData, UpdateTransactionFormData } from '../schemas/transaction.schema';

export const transactionsApi = {
  // Get all transactions for the current user
  getAll: async () => {
    const supabase = createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        category:categories(id, name, icon, color),
        account:bank_accounts(id, name, currency)
      `)
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
      throw new Error(error.message || 'Failed to fetch transactions');
    }

    return data;
  },

  // Get a single transaction by ID
  getById: async (id: string) => {
    const supabase = createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        category:categories(id, name, icon, color),
        account:bank_accounts(id, name, currency)
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error fetching transaction:', error);
      throw new Error(error.message || 'Failed to fetch transaction');
    }

    return data;
  },

  // Create a new transaction
  create: async (transactionData: CreateTransactionFormData) => {
    const supabase = createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    // Calculate amount_home based on exchange rate
    const amount_home = transactionData.amount_original * transactionData.exchange_rate;

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        description: transactionData.description || null,
        amount_original: transactionData.amount_original,
        amount_home: amount_home,
        date: transactionData.date,
        category_id: transactionData.category_id || null,
        account_id: transactionData.account_id,
        currency_original: transactionData.currency_original,
        exchange_rate: transactionData.exchange_rate,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating transaction:', error);
      throw new Error(error.message || 'Failed to create transaction');
    }

    return data;
  },

  // Update an existing transaction
  update: async (id: string, transactionData: UpdateTransactionFormData) => {
    const supabase = createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    // If amount_original or exchange_rate changed, recalculate amount_home
    let amount_home;
    if (transactionData.amount_original !== undefined || transactionData.exchange_rate !== undefined) {
      // Get current transaction to access current values
      const { data: currentTransaction } = await supabase
        .from('transactions')
        .select('amount_original, exchange_rate')
        .eq('id', id)
        .single();

      const finalAmount = transactionData.amount_original ?? currentTransaction?.amount_original ?? 0;
      const finalExchangeRate = transactionData.exchange_rate ?? currentTransaction?.exchange_rate ?? 1;

      amount_home = finalAmount * finalExchangeRate;
    }

    const updatePayload: any = { ...transactionData };
    if (amount_home !== undefined) {
      updatePayload.amount_home = amount_home;
    }

    const { data, error } = await supabase
      .from('transactions')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating transaction:', error);
      throw new Error(error.message || 'Failed to update transaction');
    }

    return data;
  },

  // Delete a transaction
  delete: async (id: string) => {
    const supabase = createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting transaction:', error);
      throw new Error(error.message || 'Failed to delete transaction');
    }
  },
};
