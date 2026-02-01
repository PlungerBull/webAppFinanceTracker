import { useQuery } from '@tanstack/react-query';
import { currenciesApi } from '@/features/currencies/api/currencies';
import { QUERY_KEYS, createQueryOptions } from '@/lib/constants';

/**
 * Hook to fetch all global currencies (read-only)
 *
 * Uses REFERENCE volatility: 24h gcTime for instant hydration on iOS.
 *
 * S-Tier Pattern: Unwraps DataResult and throws actual DomainError
 * for React Query error handling with preserved instanceof checks.
 */
export function useCurrencies() {
  return useQuery({
    queryKey: QUERY_KEYS.CURRENCIES,
    queryFn: async () => {
      const result = await currenciesApi.getAll();
      if (!result.success) {
        // S-Tier: Throw actual DomainError, not generic Error
        throw result.error;
      }
      return result.data;
    },
    ...createQueryOptions('REFERENCE'),
  });
}
