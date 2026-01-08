import { createClient } from '@/lib/supabase/client';
import { dbUserSettingsToDomain } from '@/lib/types/data-transformers';

export const userSettingsApi = {
    /**
     * Get user settings for the current user (RLS handles user filtering)
     */
    getSettings: async () => {
        const supabase = createClient();

        const { data, error } = await supabase
            .from('user_settings')
            .select('*')
            .single();

        if (error) {
            console.error('Error fetching user settings:', error);
            throw new Error(error.message || 'Failed to fetch user settings');
        }

        return dbUserSettingsToDomain(data);
    },

    /**
     * Update the main currency preference for the current user
     */
    updateMainCurrency: async (currencyCode: string) => {
        const supabase = createClient();

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            throw new Error('User not authenticated');
        }

        const { data, error } = await supabase
            .from('user_settings')
            .update({ main_currency: currencyCode.toUpperCase() })
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) {
            console.error('Error updating main currency:', error);
            throw new Error(error.message || 'Failed to update main currency');
        }

        return dbUserSettingsToDomain(data);
    },

    /**
     * Update the transaction sort preference for the current user
     */
    updateSortPreference: async (sortBy: 'date' | 'created_at') => {
        const supabase = createClient();

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            throw new Error('User not authenticated');
        }

        const { data, error } = await supabase
            .from('user_settings')
            .update({ transaction_sort_preference: sortBy })
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) {
            console.error('Error updating sort preference:', error);
            throw new Error(error.message || 'Failed to update sort preference');
        }

        return dbUserSettingsToDomain(data);
    },
};
