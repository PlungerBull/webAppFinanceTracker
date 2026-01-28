import type { SupabaseClient } from '@supabase/supabase-js';
import type { IAuthProvider } from '@/lib/auth/auth-provider.interface';
import { createSupabaseAuthProvider } from '@/lib/auth/supabase-auth-provider';
import { dbUserSettingsToDomain } from '@/lib/data/data-transformers';
import { validateOrThrow } from '@/lib/data/validate';
import { UserSettingsRowSchema } from '@/lib/data/db-row-schemas';

export class UserSettingsService {
    constructor(
        private readonly supabase: SupabaseClient,
        private readonly authProvider: IAuthProvider
    ) {}

    private async getCurrentUserId(): Promise<string> {
        return this.authProvider.getCurrentUserId();
    }

    /**
     * Get user settings for the current user (RLS handles user filtering)
     */
    async getSettings() {
        const { data, error } = await this.supabase
            .from('user_settings')
            .select('*')
            .single();

        if (error) {
            console.error('Error fetching user settings:', error);
            throw new Error(error.message || 'Failed to fetch user settings');
        }

        return dbUserSettingsToDomain(validateOrThrow(UserSettingsRowSchema, data, 'UserSettingsRow'));
    }

    /**
     * Update the main currency preference for the current user
     */
    async updateMainCurrency(currencyCode: string) {
        const userId = await this.getCurrentUserId();

        const { data, error } = await this.supabase
            .from('user_settings')
            .update({ main_currency: currencyCode.toUpperCase() })
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            console.error('Error updating main currency:', error);
            throw new Error(error.message || 'Failed to update main currency');
        }

        return dbUserSettingsToDomain(validateOrThrow(UserSettingsRowSchema, data, 'UserSettingsRow'));
    }

    /**
     * Update the transaction sort preference for the current user
     */
    async updateSortPreference(sortBy: 'date' | 'created_at') {
        const userId = await this.getCurrentUserId();

        const { data, error } = await this.supabase
            .from('user_settings')
            .update({ transaction_sort_preference: sortBy })
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            console.error('Error updating sort preference:', error);
            throw new Error(error.message || 'Failed to update sort preference');
        }

        return dbUserSettingsToDomain(validateOrThrow(UserSettingsRowSchema, data, 'UserSettingsRow'));
    }
}

/**
 * Factory function to create UserSettingsService with proper DI.
 */
export function createUserSettingsService(supabase: SupabaseClient): UserSettingsService {
    const authProvider = createSupabaseAuthProvider(supabase);
    return new UserSettingsService(supabase, authProvider);
}
