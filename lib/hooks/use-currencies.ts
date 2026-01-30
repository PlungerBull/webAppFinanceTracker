import { useQuery } from '@tanstack/react-query';
import { currenciesApi } from '@/features/currencies/api/currencies';
import { QUERY_CONFIG, QUERY_KEYS } from '@/lib/constants';

/**
 * Hook to fetch all global currencies (read-only)
 */
export function useCurrencies() {
  return useQuery({
    queryKey: QUERY_KEYS.CURRENCIES,
    queryFn: currenciesApi.getAll,
    staleTime: QUERY_CONFIG.STALE_TIME.LONG, // Currencies rarely change
  });
}
