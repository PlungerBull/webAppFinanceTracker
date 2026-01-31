/**
 * Settings Domain Types
 *
 * User settings entities and operations interface for cross-feature use.
 *
 * @module domain/settings
 */

// Re-export the UserSettings type from types/domain
// This centralizes all domain types in the @/domain barrel
export type { UserSettings, TransactionSortMode } from '@/types/domain';
