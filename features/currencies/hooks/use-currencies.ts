import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { currenciesApi } from '../api/currencies';

export function useCurrencies() {
  return useQuery({
    queryKey: ['currencies'],
    queryFn: currenciesApi.getAll,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useAddCurrency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: currenciesApi.add,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currencies'] });
    },
  });
}
