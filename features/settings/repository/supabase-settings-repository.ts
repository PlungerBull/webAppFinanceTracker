/**
 * Supabase Settings Repository
 *
 * Implements ISettingsRepository using Supabase as the data store.
 * Handles all database operations for user settings.
 *
 * @module features/settings/repository
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import type { DataResult } from '@/lib/data-patterns';
import type { UserSettings } from '@/types/domain';
import type { ISettingsRepository } from './settings-repository.interface';
import { dbUserSettingsToDomain } from '@/lib/data/data-transformers';
import { validateOrThrow } from '@/lib/data/validate';
import { UserSettingsRowSchema } from '@/lib/data/db-row-schemas';
import { reportError } from '@/lib/sentry/reporter';
import {
  SettingsRepositoryError,
  SettingsNotFoundError,
} from '../domain/errors';

/**
 * Supabase implementation of the Settings Repository.
 *
 * Swift Mirror:
 * ```swift
 * final class SupabaseSettingsRepository: SettingsRepositoryProtocol {
 *     private let client: SupabaseClient
 *     init(client: SupabaseClient) { self.client = client }
 * }
 * ```
 */
export class SupabaseSettingsRepository implements ISettingsRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async getSettings(
    userId: string
  ): Promise<DataResult<UserSettings, SettingsRepositoryError | SettingsNotFoundError>> {
    try {
      const { data, error } = await this.supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
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
        { operation: 'getSettings', userId }
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

  async updateMainCurrency(
    userId: string,
    currencyCode: string
  ): Promise<DataResult<UserSettings, SettingsRepositoryError>> {
    try {
      const { data, error } = await this.supabase
        .from('user_settings')
        .update({ main_currency: currencyCode })
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
        { operation: 'updateMainCurrency', userId, currencyCode }
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

  async updateSortPreference(
    userId: string,
    sortBy: 'date' | 'created_at'
  ): Promise<DataResult<UserSettings, SettingsRepositoryError>> {
    try {
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
        { operation: 'updateSortPreference', userId, sortBy }
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

  async updateAccountVisibility(
    userId: string,
    updates: { accountId: string; isVisible: boolean }[]
  ): Promise<DataResult<void, SettingsRepositoryError>> {
    try {
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
        { operation: 'updateAccountVisibility', userId, updateCount: updates.length }
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

  async clearUserData(
    userId: string
  ): Promise<DataResult<void, SettingsRepositoryError>> {
    try {
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
        { operation: 'clearUserData', userId }
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
