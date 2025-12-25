import { createClient } from '@/lib/supabase/client';

export interface CreateTransferData {
  userId: string;
  fromAccountId: string;
  toAccountId: string;
  fromCurrency: string;
  toCurrency: string;
  sentAmount: number;
  receivedAmount: number; // For different currencies
  date: string;
  description?: string;
}

export const transfersApi = {
  /**
   * Create a transfer between two accounts
   * Automatically calculates implied exchange rate from sent/received amounts
   * Creates two linked transactions with NULL category_id
   */
  createTransfer: async (data: CreateTransferData) => {
    const supabase = createClient();

    // Calculate implied exchange rate from sent and received amounts
    // For same currency transfers, receivedAmount will equal sentAmount, so rate = 1
    const impliedRate = data.receivedAmount / data.sentAmount;

    const { data: result, error } = await supabase.rpc('create_transfer', {
      p_user_id: data.userId,
      p_from_account_id: data.fromAccountId,
      p_to_account_id: data.toAccountId,
      p_amount: data.sentAmount,
      p_from_currency: data.fromCurrency,
      p_to_currency: data.toCurrency,
      p_amount_received: data.receivedAmount,
      p_exchange_rate: impliedRate,
      p_date: data.date,
      p_description: data.description || 'Transfer',
      p_category_id: '', // Transfers don't have categories
    });

    if (error) {
      console.error('Error creating transfer:', error);
      throw new Error(error.message || 'Failed to create transfer');
    }

    return result;
  },
};
