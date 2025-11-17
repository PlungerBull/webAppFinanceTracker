import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { currenciesApi } from '../api/currencies';
import { QUERY_CONFIG, QUERY_KEYS } from '@/lib/constants';

export function useCurrencies() {
  return useQuery({
    queryKey: QUERY_KEYS.CURRENCIES,
    queryFn: currenciesApi.getAll,
    staleTime: QUERY_CONFIG.STALE_TIME.MEDIUM,
  });
}

export function useAddCurrency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: currenciesApi.add,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CURRENCIES });
    },
  });
}
