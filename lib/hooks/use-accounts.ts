/**
 * Account Orchestrator Hooks
 *
 * Provides account query access for cross-feature use.
 * Wraps the accounts feature implementation without creating direct feature coupling.
 *
 * ARCHITECTURE PATTERN:
 * - Components import from @/lib/hooks/use-accounts
 * - This hook internally uses the accounts feature hooks
 * - Features never import from @/features/accounts/hooks
 *
 * @module lib/hooks/use-accounts
 */

'use client';

import {
  useAccounts as useAccountsFeature,
  useAccount as useAccountFeature,
  useAccountsByGroup as useAccountsByGroupFeature,
} from '@/features/accounts/hooks/use-accounts';
import type { AccountFilters } from '@/features/accounts/domain';

// Re-export entity type
export type { AccountViewEntity } from '@/features/accounts/domain';

/**
 * Hook to fetch all accounts.
 *
 * Orchestrator wrapper around the feature hook.
 * Use this in features other than accounts.
 */
export function useAccounts(filters?: AccountFilters) {
  return useAccountsFeature(filters);
}

/**
 * Hook to fetch a single account by ID.
 *
 * Orchestrator wrapper around the feature hook.
 * Use this in features other than accounts.
 */
export function useAccount(id: string) {
  return useAccountFeature(id);
}

/**
 * Hook to fetch accounts by group ID.
 *
 * Orchestrator wrapper around the feature hook.
 * Use this in features other than accounts.
 */
export function useAccountsByGroup(groupId: string) {
  return useAccountsByGroupFeature(groupId);
}
