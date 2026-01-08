import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userSettingsApi } from '../api/user-settings';
import { QUERY_CONFIG, QUERY_KEYS } from '@/lib/constants';

/**
 * Hook to fetch user settings
 */
export function useUserSettings() {
    return useQuery({
        queryKey: QUERY_KEYS.USER_SETTINGS,
        queryFn: userSettingsApi.getSettings,
        staleTime: QUERY_CONFIG.STALE_TIME.MEDIUM,
    });
}

/**
 * Hook to update the main currency preference
 */
export function useUpdateMainCurrency() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: userSettingsApi.updateMainCurrency,
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

    return useMutation({
        mutationFn: userSettingsApi.updateSortPreference,
        onSuccess: () => {
            // Invalidate settings to update cached preference
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USER_SETTINGS });
            // Invalidate transactions to trigger re-fetch with new sort
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
        },
    });
}
