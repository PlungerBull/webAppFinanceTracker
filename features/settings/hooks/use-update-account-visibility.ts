import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export function useUpdateAccountVisibility() {
    const queryClient = useQueryClient();
    const supabase = createClient();

    return useMutation({
        mutationFn: async (updates: { accountId: string; isVisible: boolean }[]) => {
            // Supabase doesn't support bulk updates with different values easily in one query
            // unless we use a stored procedure or complex upsert logic.
            // For simplicity and given the small number of accounts, we'll run parallel updates.
            // A better approach for larger datasets would be an RPC function.

            const promises = updates.map(({ accountId, isVisible }) =>
                supabase
                    .from('bank_accounts')
                    .update({ is_visible: isVisible })
                    .eq('id', accountId)
            );

            await Promise.all(promises);
        },
        onSuccess: () => {
            toast.success('Appearance settings saved');
            // Invalidate accounts query to refresh the list
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            queryClient.invalidateQueries({ queryKey: ['grouped-accounts'] });
        },
        onError: (error) => {
            console.error('Failed to update visibility:', error);
            toast.error('Failed to save settings');
        },
    });
}
