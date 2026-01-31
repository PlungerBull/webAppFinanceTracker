/**
 * User Settings Orchestrator Hook
 *
 * Provides user settings access for cross-feature use.
 * Wraps the settings feature implementation without creating direct feature coupling.
 *
 * ARCHITECTURE PATTERN:
 * - Components import from @/lib/hooks/use-user-settings
 * - This hook internally uses the settings feature hooks
 * - Features never import from @/features/settings/hooks
 *
 * @module lib/hooks/use-user-settings
 */

'use client';

// Import feature hooks - allowed in lib/ as the orchestration layer
import {
  useUserSettings as useUserSettingsFeature,
  useUpdateSortPreference as useUpdateSortPreferenceFeature,
  useUpdateMainCurrency as useUpdateMainCurrencyFeature,
} from '@/features/settings/hooks/use-user-settings';

/**
 * Hook to fetch user settings.
 *
 * Orchestrator wrapper around the feature hook.
 * Use this in features other than settings.
 */
export function useUserSettings() {
  return useUserSettingsFeature();
}

/**
 * Hook to update the transaction sort preference.
 *
 * Orchestrator wrapper around the feature hook.
 * Use this in features other than settings.
 */
export function useUpdateSortPreference() {
  return useUpdateSortPreferenceFeature();
}

/**
 * Hook to update the main currency preference.
 *
 * Orchestrator wrapper around the feature hook.
 * Use this in features other than settings.
 */
export function useUpdateMainCurrency() {
  return useUpdateMainCurrencyFeature();
}
