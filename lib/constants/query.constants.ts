/**
 * React Query configuration and cache key constants
 */

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
 * React Query key factories
 * Centralized to ensure consistency across the app
 */
export const QUERY_KEYS = {
  ACCOUNTS: ['accounts'] as const,
  ACCOUNT_CURRENCIES: (accountId?: string) =>
    accountId ? ['account-currencies', accountId] : ['account-currencies'],
  CATEGORIES: ['categories'] as const,
  CURRENCIES: ['currencies'] as const,
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
