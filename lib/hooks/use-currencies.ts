import { useQuery } from '@tanstack/react-query';
import { currenciesApi } from '@/features/currencies/api/currencies';
import { QUERY_KEYS, createQueryOptions } from '@/lib/constants';

/**
 * Hook to fetch all global currencies (read-only)
 *
 * Uses REFERENCE volatility: 24h gcTime for instant hydration on iOS.
 */
export function useCurrencies() {
  return useQuery({
    queryKey: QUERY_KEYS.CURRENCIES,
    queryFn: currenciesApi.getAll,
    ...createQueryOptions('REFERENCE'),
  });
}
