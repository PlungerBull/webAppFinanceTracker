/**
 * Settings Domain Types
 *
 * User settings entities and operations interface for cross-feature use.
 *
 * SINGLE SOURCE OF TRUTH: TRANSACTION_SORT_MODES is the canonical enum.
 * All consumers (Zod schema, transformer, components) derive from this constant.
 * The PostgreSQL CHECK constraint mirrors these values at the DB layer.
 *
 * @module domain/settings
 */

/**
 * Canonical sort mode values — single source of truth.
 * Mirrored by: Postgres CHECK constraint, Zod schema, transformer map.
 */
export const TRANSACTION_SORT_MODES = ['date', 'created_at'] as const;

/** Derived union type from the runtime constant */
export type TransactionSortMode = (typeof TRANSACTION_SORT_MODES)[number];

/** Safe default when an unknown value arrives from the DB */
export const DEFAULT_TRANSACTION_SORT_MODE: TransactionSortMode = 'date';

// Re-export the UserSettings type from types/domain
export type { UserSettings } from '@/types/domain';
