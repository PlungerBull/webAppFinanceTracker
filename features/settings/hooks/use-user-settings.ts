/**
 * User Settings Hooks
 *
 * React Query hooks for user settings operations.
 * S-Tier Pattern: Unwraps DataResult and throws actual DomainError
 * for React Query error handling with preserved instanceof checks.
 *
 * @module features/settings/hooks
 */

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { createUserSettingsService } from '../api/user-settings';
import { QUERY_KEYS, createQueryOptions } from '@/lib/constants';

function useUserSettingsService() {
  return useMemo(() => {
    const supabase = createClient();
    return createUserSettingsService(supabase);
  }, []);
}

/**
 * Hook to fetch user settings
 *
 * S-Tier: Throws actual DomainError for type-safe error handling.
 */
export function useUserSettings() {
  const service = useUserSettingsService();

  return useQuery({
    queryKey: QUERY_KEYS.USER_SETTINGS,
    queryFn: async () => {
      const result = await service.getSettings();
      if (!result.success) {
        // S-Tier: Throw actual DomainError, not generic Error
        throw result.error;
      }
      return result.data;
    },
    ...createQueryOptions('STRUCTURAL'),
  });
}

/**
 * Hook to update the main currency preference
 *
 * S-Tier: Includes referential integrity check (validates currency exists).
 * Throws SettingsValidationError if currency code is invalid.
 */
export function useUpdateMainCurrency() {
  const queryClient = useQueryClient();
  const service = useUserSettingsService();

  return useMutation({
    mutationFn: async (currencyCode: string) => {
      const result = await service.updateMainCurrency(currencyCode);
      if (!result.success) {
        // S-Tier: Throw actual DomainError for typed error handling
        throw result.error;
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USER_SETTINGS });
    },
  });
}

/**
 * Hook to update the transaction sort preference
 */
export function useUpdateSortPreference() {
  const queryClient = useQueryClient();
  const service = useUserSettingsService();

  return useMutation({
    mutationFn: async (sortBy: 'date' | 'created_at') => {
      const result = await service.updateSortPreference(sortBy);
      if (!result.success) {
        // S-Tier: Throw actual DomainError
        throw result.error;
      }
      return result.data;
    },
    onSuccess: () => {
      // Invalidate settings to update cached preference
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USER_SETTINGS });
      // Invalidate transactions to trigger re-fetch with new sort
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

/**
 * Hook to clear all user data
 *
 * Dangerous operation - deletes all user-owned records.
 */
export function useClearUserData() {
  const queryClient = useQueryClient();
  const service = useUserSettingsService();

  return useMutation({
    mutationFn: async () => {
      const result = await service.clearUserData();
      if (!result.success) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: () => {
      // Invalidate all queries to clear stale data
      queryClient.invalidateQueries();
    },
  });
}
