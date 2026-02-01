/**
 * Scalability Guardrails Constants
 *
 * S-TIER ARCHITECTURE: Defensive Design
 * Configurable limits for dashboard computations that prevent
 * O(n) operations from degrading UX at scale.
 *
 * These are WARNINGS, not hard limits. The system continues
 * to work but logs performance concerns in development.
 */

export const GUARDRAILS = {
  /**
   * Category limits
   * Dashboard financial overview performance degrades above these thresholds
   */
  CATEGORIES: {
    /** Warn when total categories exceed this (parents + children) */
    WARN_TOTAL: 200,
    /** Maximum children per parent before warning */
    WARN_CHILDREN_PER_PARENT: 50,
  },

  /**
   * Account limits
   * Account grouping performance degrades above these thresholds
   */
  ACCOUNTS: {
    /** Warn when total accounts exceed this */
    WARN_TOTAL: 100,
    /** Maximum accounts per group before warning */
    WARN_PER_GROUP: 20,
  },

  /**
   * Development/logging configuration
   */
  DEV: {
    /** Log performance warnings in development */
    LOG_WARNINGS: process.env.NODE_ENV === 'development',
    /** Performance threshold for warning (ms) */
    PERF_WARN_THRESHOLD_MS: 50,
  },
} as const;

/**
 * Type exports for strict typing
 */
export type GuardrailCategory = typeof GUARDRAILS.CATEGORIES;
export type GuardrailAccount = typeof GUARDRAILS.ACCOUNTS;
