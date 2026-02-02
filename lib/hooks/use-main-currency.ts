/**
 * Main Currency Hook
 *
 * Provides user's main currency preference without depending on features.
 * This is the decoupled replacement for currency-context's useUserSettings dependency.
 *
 * ARCHITECTURE:
 * - Lives in lib/ to avoid context → feature dependency
 * - Uses MainCurrencyService with IOC pattern
 * - Uses dedicated MAIN_CURRENCY query key (separate from USER_SETTINGS)
 *
 * S-TIER SEPARATION:
 * - main-currency is a global concern (lib/)
 * - user-settings is a feature-specific concern (features/settings/)
 * - Separate query keys prevent cache shape conflicts
 *
 * CACHE PULSE ALIGNMENT:
 * - staleTime: QUERY_CONFIG.STALE_TIME.MEDIUM (5 min)
 * - gcTime: QUERY_CONFIG.CACHE_TIME.MEDIUM (10 min)
 *
 * @module lib/hooks/use-main-currency
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { createMainCurrencyService } from '@/lib/api/main-currency-service';
import { QUERY_CONFIG, QUERY_KEYS, CURRENCY } from '@/lib/constants';

/**
 * Creates memoized service instance.
 *
 * Prevents recreating service on every render while ensuring
 * we get fresh Supabase client per browser session.
 */
function useMainCurrencyService() {
  return useMemo(() => {
    const supabase = createClient();
    return createMainCurrencyService(supabase);
  }, []);
}

/**
 * Hook to fetch user's main currency preference.
 *
 * Decoupled from settings feature - lives in lib for cross-feature use.
 * Uses same query key as useUserSettings for cache sharing.
 *
 * @returns { mainCurrency, isLoading, error }
 *
 * @example
 * ```typescript
 * const { mainCurrency, isLoading } = useMainCurrency();
 * if (isLoading) return <Loading />;
 * return <span>Currency: {mainCurrency}</span>;
 * ```
 */
export function useMainCurrency() {
  const service = useMainCurrencyService();

  const { data, isLoading, error } = useQuery({
    // S-TIER: Dedicated query key for global concern (separate from feature-specific settings)
    queryKey: QUERY_KEYS.MAIN_CURRENCY,
    queryFn: () => service.getMainCurrency(),
    // CACHE PULSE ALIGNMENT: Explicit config from QUERY_CONFIG
    staleTime: QUERY_CONFIG.STALE_TIME.MEDIUM,  // 5 minutes
    gcTime: QUERY_CONFIG.CACHE_TIME.MEDIUM,      // 10 minutes (garbage collection)
    // Select mainCurrency from result
    select: (result) => result.mainCurrency,
  });

  return {
    mainCurrency: data ?? CURRENCY.DEFAULT,
    isLoading,
    error,
  };
}
