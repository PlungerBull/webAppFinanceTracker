import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountCurrenciesApi } from '../api/account-currencies';
import type { Database } from '@/types/database.types';

type AccountCurrencyInsert = Database['public']['Tables']['account_currencies']['Insert'];
type AccountCurrencyUpdate = Database['public']['Tables']['account_currencies']['Update'];

/**
 * Hook to get all currencies for a specific account
 */
export function useAccountCurrencies(accountId: string | null) {
  return useQuery({
    queryKey: ['account-currencies', accountId],
    queryFn: () => accountId ? accountCurrenciesApi.getByAccountId(accountId) : Promise.resolve([]),
    enabled: !!accountId,
  });
}

/**
 * Hook to add a currency to an account
 */
export function useAddAccountCurrency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AccountCurrencyInsert) => accountCurrenciesApi.create(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['account-currencies', variables.account_id] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

/**
 * Hook to update an account currency
 */
export function useUpdateAccountCurrency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AccountCurrencyUpdate }) =>
      accountCurrenciesApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['account-currencies', data.account_id] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

/**
 * Hook to remove a currency from an account
 */
export function useDeleteAccountCurrency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => accountCurrenciesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-currencies'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

/**
 * Hook to add multiple currencies to an account at once
 */
export function useAddAccountCurrencies() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AccountCurrencyInsert[]) => accountCurrenciesApi.createMany(data),
    onSuccess: (data) => {
      if (data.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['account-currencies', data[0].account_id] });
        queryClient.invalidateQueries({ queryKey: ['accounts'] });
      }
    },
  });
}
