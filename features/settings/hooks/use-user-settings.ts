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
 */
export function useUserSettings() {
    const service = useUserSettingsService();

    return useQuery({
        queryKey: QUERY_KEYS.USER_SETTINGS,
        queryFn: () => service.getSettings(),
        ...createQueryOptions('STRUCTURAL'),
    });
}

/**
 * Hook to update the main currency preference
 */
export function useUpdateMainCurrency() {
    const queryClient = useQueryClient();
    const service = useUserSettingsService();

    return useMutation({
        mutationFn: (currencyCode: string) => service.updateMainCurrency(currencyCode),
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
        mutationFn: (sortBy: 'date' | 'created_at') => service.updateSortPreference(sortBy),
        onSuccess: () => {
            // Invalidate settings to update cached preference
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USER_SETTINGS });
            // Invalidate transactions to trigger re-fetch with new sort
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
        },
    });
}
