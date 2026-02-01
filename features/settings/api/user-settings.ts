/**
 * User Settings Service
 *
 * Service layer for user settings operations.
 * Returns DataResult for S-Tier error handling across Native Bridge.
 *
 * @module features/settings/api
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { IAuthProvider } from '@/lib/auth/auth-provider.interface';
import type { DataResult } from '@/lib/data-patterns';
import type { UserSettings } from '@/types/domain';
import { createSupabaseAuthProvider } from '@/lib/auth/supabase-auth-provider';
import { dbUserSettingsToDomain } from '@/lib/data/data-transformers';
import { validateOrThrow } from '@/lib/data/validate';
import { UserSettingsRowSchema } from '@/lib/data/db-row-schemas';
import { reportError } from '@/lib/sentry/reporter';
import { currenciesApi } from '@/features/currencies/api/currencies';
import {
  SettingsRepositoryError,
  SettingsNotFoundError,
  SettingsValidationError,
  SettingsAuthenticationError,
} from '../domain/errors';

export class UserSettingsService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly authProvider: IAuthProvider
  ) {}

  private async getCurrentUserId(): Promise<DataResult<string, SettingsAuthenticationError>> {
    try {
      const userId = await this.authProvider.getCurrentUserId();
      return { success: true, data: userId };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new SettingsAuthenticationError('User not authenticated', err),
      };
    }
  }

  /**
   * Get user settings for the current user (RLS handles user filtering)
   */
  async getSettings(): Promise<DataResult<UserSettings, SettingsRepositoryError | SettingsNotFoundError>> {
    try {
      const { data, error } = await this.supabase
        .from('user_settings')
        .select('*')
        .single();

      if (error) {
        // PGRST116 = "JSON object requested, multiple (or no) rows returned"
        if (error.code === 'PGRST116') {
          return {
            success: false,
            data: null,
            error: new SettingsNotFoundError('User settings not found', error),
          };
        }
        return {
          success: false,
          data: null,
          error: new SettingsRepositoryError(
            error.message || 'Failed to fetch user settings',
            error
          ),
        };
      }

      const validated = validateOrThrow(UserSettingsRowSchema, data, 'UserSettingsRow');
      return {
        success: true,
        data: dbUserSettingsToDomain(validated),
      };
    } catch (err) {
      reportError(
        err instanceof Error ? err : new Error(String(err)),
        'settings',
        { operation: 'getSettings' }
      );
      return {
        success: false,
        data: null,
        error: new SettingsRepositoryError(
          'Unexpected error fetching settings',
          err
        ),
      };
    }
  }

  /**
   * Update the main currency preference for the current user
   *
   * S-Tier: Includes referential integrity check to validate currency exists
   */
  async updateMainCurrency(
    currencyCode: string
  ): Promise<DataResult<UserSettings, SettingsRepositoryError | SettingsValidationError | SettingsAuthenticationError>> {
    try {
      // Get current user ID
      const userIdResult = await this.getCurrentUserId();
      if (!userIdResult.success) {
        return userIdResult;
      }
      const userId = userIdResult.data;

      // S-Tier: Referential integrity check - validate currency exists
      const currencyResult = await currenciesApi.getAll();
      if (!currencyResult.success) {
        return {
          success: false,
          data: null,
          error: new SettingsRepositoryError(
            'Failed to validate currency',
            currencyResult.error
          ),
        };
      }

      const normalizedCode = currencyCode.toUpperCase();
      const validCurrency = currencyResult.data.find(c => c.code === normalizedCode);
      if (!validCurrency) {
        return {
          success: false,
          data: null,
          error: new SettingsValidationError(`Invalid currency code: ${currencyCode}`),
        };
      }

      // Update the setting
      const { data, error } = await this.supabase
        .from('user_settings')
        .update({ main_currency: normalizedCode })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          data: null,
          error: new SettingsRepositoryError(
            error.message || 'Failed to update main currency',
            error
          ),
        };
      }

      const validated = validateOrThrow(UserSettingsRowSchema, data, 'UserSettingsRow');
      return {
        success: true,
        data: dbUserSettingsToDomain(validated),
      };
    } catch (err) {
      reportError(
        err instanceof Error ? err : new Error(String(err)),
        'settings',
        { operation: 'updateMainCurrency', currencyCode }
      );
      return {
        success: false,
        data: null,
        error: new SettingsRepositoryError(
          'Unexpected error updating main currency',
          err
        ),
      };
    }
  }

  /**
   * Update the transaction sort preference for the current user
   */
  async updateSortPreference(
    sortBy: 'date' | 'created_at'
  ): Promise<DataResult<UserSettings, SettingsRepositoryError | SettingsAuthenticationError>> {
    try {
      // Get current user ID
      const userIdResult = await this.getCurrentUserId();
      if (!userIdResult.success) {
        return userIdResult;
      }
      const userId = userIdResult.data;

      const { data, error } = await this.supabase
        .from('user_settings')
        .update({ transaction_sort_preference: sortBy })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          data: null,
          error: new SettingsRepositoryError(
            error.message || 'Failed to update sort preference',
            error
          ),
        };
      }

      const validated = validateOrThrow(UserSettingsRowSchema, data, 'UserSettingsRow');
      return {
        success: true,
        data: dbUserSettingsToDomain(validated),
      };
    } catch (err) {
      reportError(
        err instanceof Error ? err : new Error(String(err)),
        'settings',
        { operation: 'updateSortPreference', sortBy }
      );
      return {
        success: false,
        data: null,
        error: new SettingsRepositoryError(
          'Unexpected error updating sort preference',
          err
        ),
      };
    }
  }

  /**
   * Update account visibility settings (batch operation)
   *
   * S-Tier: Batch operation for Native Bridge performance
   */
  async updateAccountVisibility(
    updates: { accountId: string; isVisible: boolean }[]
  ): Promise<DataResult<void, SettingsRepositoryError | SettingsAuthenticationError>> {
    try {
      // Get current user ID
      const userIdResult = await this.getCurrentUserId();
      if (!userIdResult.success) {
        return userIdResult;
      }
      const userId = userIdResult.data;

      // Use Promise.allSettled for better error handling
      const results = await Promise.allSettled(
        updates.map(({ accountId, isVisible }) =>
          this.supabase
            .from('bank_accounts')
            .update({ is_visible: isVisible })
            .eq('id', accountId)
            .eq('user_id', userId)
        )
      );

      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        return {
          success: false,
          data: null,
          error: new SettingsRepositoryError(
            `Failed to update ${failures.length} account(s) visibility`
          ),
        };
      }

      // Check for Supabase errors in fulfilled results
      const supabaseErrorCount = results
        .filter((r) => r.status === 'fulfilled')
        .filter((r) => {
          const fulfilled = r as PromiseFulfilledResult<{ error: unknown }>;
          return fulfilled.value?.error;
        }).length;

      if (supabaseErrorCount > 0) {
        return {
          success: false,
          data: null,
          error: new SettingsRepositoryError(
            `Failed to update ${supabaseErrorCount} account(s) visibility`
          ),
        };
      }

      return { success: true, data: undefined };
    } catch (err) {
      reportError(
        err instanceof Error ? err : new Error(String(err)),
        'settings',
        { operation: 'updateAccountVisibility', updateCount: updates.length }
      );
      return {
        success: false,
        data: null,
        error: new SettingsRepositoryError(
          'Unexpected error updating account visibility',
          err
        ),
      };
    }
  }

  /**
   * Clear all user data (dangerous operation)
   *
   * Calls the `clear_user_data` RPC to delete all user-owned records.
   */
  async clearUserData(): Promise<DataResult<void, SettingsRepositoryError | SettingsAuthenticationError>> {
    try {
      // Get current user ID
      const userIdResult = await this.getCurrentUserId();
      if (!userIdResult.success) {
        return userIdResult;
      }
      const userId = userIdResult.data;

      const { error } = await this.supabase.rpc('clear_user_data', {
        p_user_id: userId,
      });

      if (error) {
        return {
          success: false,
          data: null,
          error: new SettingsRepositoryError(
            error.message || 'Failed to clear user data',
            error
          ),
        };
      }

      return { success: true, data: undefined };
    } catch (err) {
      reportError(
        err instanceof Error ? err : new Error(String(err)),
        'settings',
        { operation: 'clearUserData' }
      );
      return {
        success: false,
        data: null,
        error: new SettingsRepositoryError(
          'Unexpected error clearing user data',
          err
        ),
      };
    }
  }
}

/**
 * Factory function to create UserSettingsService with proper DI.
 */
export function createUserSettingsService(supabase: SupabaseClient): UserSettingsService {
  const authProvider = createSupabaseAuthProvider(supabase);
  return new UserSettingsService(supabase, authProvider);
}
