/**
 * React Query configuration and cache key constants
 *
 * S-TIER ARCHITECTURE: Volatility Engine
 * Provides semantic data freshness classification for iOS/mobile optimization.
 * - Prevents bridge saturation on app resume
 * - Enables instant hydration (show stale while fetching fresh)
 * - Manages memory pressure on older devices
 */

/**
 * Pagination constants for infinite scroll
 */
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 50,
  VIRTUAL_ITEM_SIZE_ESTIMATE: 80, // Card height (64px) + gap (16px)
  OVERSCAN: 5,
} as const;

export const QUERY_CONFIG = {
  /**
   * Stale time: How long data is considered fresh before refetching
   */
  STALE_TIME: {
    SHORT: 1 * 60 * 1000, // 1 minute - Frequently changing data
    MEDIUM: 5 * 60 * 1000, // 5 minutes - Semi-static data (categories, currencies)
    LONG: 10 * 60 * 1000, // 10 minutes - Rarely changing data
  },

  /**
   * Cache time: How long unused data stays in cache
   */
  CACHE_TIME: {
    SHORT: 5 * 60 * 1000, // 5 minutes
    MEDIUM: 10 * 60 * 1000, // 10 minutes
    LONG: 30 * 60 * 1000, // 30 minutes
  },

  /**
   * Default query config for the app
   */
  DEFAULT: {
    STALE_TIME: 60 * 1000, // 1 minute
  },
} as const;

/**
 * Data Volatility Classification
 *
 * Semantic categories for query freshness configuration.
 * Developers think in data nature, not milliseconds.
 *
 * @example
 * - REFERENCE: Currencies, system config (rarely changes)
 * - STRUCTURAL: Categories, Groupings, Accounts (semi-static)
 * - TRANSACTIONAL: Transactions, Balances (volatile)
 */
export const DATA_VOLATILITY = {
  REFERENCE: 'REFERENCE',
  STRUCTURAL: 'STRUCTURAL',
  TRANSACTIONAL: 'TRANSACTIONAL',
} as const;

export type DataVolatility = keyof typeof DATA_VOLATILITY;

/**
 * Query Options Factory (iOS-Optimized)
 *
 * Creates pre-configured query options based on data volatility.
 * Ensures consistent caching behavior across the entire app.
 *
 * iOS/Mobile Optimizations:
 * - gcTime >> staleTime: Enables instant hydration (show cached while fetching)
 * - refetchOnWindowFocus: false: Prevents bridge saturation on app resume
 * - TRANSACTIONAL staleTime >= sync heartbeat: Prevents query/sync conflicts
 *
 * @param volatility - The data volatility classification
 * @param overrides - Optional overrides for specific use cases
 * @returns Query options object to spread into useQuery
 *
 * @example
 * ```typescript
 * return useQuery({
 *   queryKey: QUERY_KEYS.CATEGORIES,
 *   queryFn: () => service.getAll(),
 *   ...createQueryOptions('STRUCTURAL'),
 *   enabled: !!service,
 * });
 * ```
 */
export function createQueryOptions(
  volatility: DataVolatility,
  overrides?: { staleTime?: number; gcTime?: number; refetchOnWindowFocus?: boolean }
): { staleTime: number; gcTime: number; refetchOnWindowFocus: boolean } {
  const config = {
    REFERENCE: {
      staleTime: QUERY_CONFIG.STALE_TIME.LONG, // 10m - rarely changes
      gcTime: 24 * 60 * 60 * 1000, // 24h - keep in memory for instant hydration
      refetchOnWindowFocus: false, // Don't hammer bridge on app resume
    },
    STRUCTURAL: {
      staleTime: QUERY_CONFIG.STALE_TIME.MEDIUM, // 5m - semi-static
      gcTime: QUERY_CONFIG.CACHE_TIME.LONG, // 30m - persist for offline
      refetchOnWindowFocus: false, // Prevent bridge saturation
    },
    TRANSACTIONAL: {
      staleTime: QUERY_CONFIG.STALE_TIME.SHORT, // 1m - volatile (>= sync heartbeat)
      gcTime: QUERY_CONFIG.CACHE_TIME.MEDIUM, // 10m - balance freshness vs memory
      refetchOnWindowFocus: false, // Controlled by sync engine, not window events
    },
  };

  return { ...config[volatility], ...overrides };
}

/**
 * React Query key factories
 * Centralized to ensure consistency across the app
 */
export const QUERY_KEYS = {
  ACCOUNTS: ['accounts'] as const,
  ACCOUNT_CURRENCIES: (accountId?: string) =>
    accountId ? ['account-currencies', accountId] : ['account-currencies'],
  CATEGORIES: ['categories'] as const,
  CURRENCIES: ['currencies'] as const,
  GROUPINGS: ['groupings'] as const,
  GROUPING_CHILDREN: (parentId: string) => ['grouping-children', parentId] as const,
  USER_SETTINGS: ['user-settings'] as const,
  TRANSACTIONS: {
    ALL: ['transactions'] as const,
    MONTHLY_SPENDING: (monthsBack: number) =>
      ['transactions', 'monthly-spending', monthsBack] as const,
  },
} as const;

/**
 * Type-safe access to constant values
 */
export type QueryStaleTime = (typeof QUERY_CONFIG.STALE_TIME)[keyof typeof QUERY_CONFIG.STALE_TIME];
export type QueryCacheTime = (typeof QUERY_CONFIG.CACHE_TIME)[keyof typeof QUERY_CONFIG.CACHE_TIME];
