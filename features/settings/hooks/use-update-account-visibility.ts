/**
 * Account Visibility Hook
 *
 * Hook for updating account visibility settings.
 * S-Tier: Uses service layer with DataResult pattern.
 *
 * @module features/settings/hooks
 */

import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { createUserSettingsService } from '../api/user-settings';
import { toast } from 'sonner';

function useUserSettingsService() {
  return useMemo(() => {
    const supabase = createClient();
    return createUserSettingsService(supabase);
  }, []);
}

/**
 * Hook to update account visibility settings (batch operation)
 *
 * S-Tier: Uses service layer with DataResult for proper error handling.
 * Batch operation optimized for Native Bridge performance.
 */
export function useUpdateAccountVisibility() {
  const queryClient = useQueryClient();
  const service = useUserSettingsService();

  return useMutation({
    mutationFn: async (updates: { accountId: string; isVisible: boolean }[]) => {
      const result = await service.updateAccountVisibility(updates);
      if (!result.success) {
        // S-Tier: Throw actual DomainError
        throw result.error;
      }
      return result.data;
    },
    onSuccess: () => {
      toast.success('Appearance settings saved');
      // Invalidate accounts query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['grouped-accounts'] });
    },
    onError: (error: Error) => {
      console.error('Failed to update visibility:', error);
      toast.error('Failed to save settings');
    },
  });
}
