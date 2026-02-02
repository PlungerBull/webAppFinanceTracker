/**
 * User Settings Service
 *
 * Service layer for user settings operations.
 * Handles business logic (validation, authorization) and delegates
 * data access to the repository.
 *
 * Returns DataResult for S-Tier error handling across Native Bridge.
 *
 * @module features/settings/api
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import type { IAuthProvider } from '@/lib/auth/auth-provider.interface';
import type { DataResult } from '@/lib/data-patterns';
import type { UserSettings } from '@/types/domain';
import type { ISettingsRepository } from '../repository';
import { createSupabaseAuthProvider } from '@/lib/auth/supabase-auth-provider';
import { SupabaseSettingsRepository } from '../repository';
import { currenciesApi } from '@/features/currencies/api/currencies';
import {
  SettingsRepositoryError,
  SettingsValidationError,
  SettingsAuthenticationError,
} from '../domain/errors';

export class UserSettingsService {
  constructor(
    private readonly repository: ISettingsRepository,
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
   * Get user settings for the current user.
   * Self-healing: If settings don't exist, they are auto-provisioned with defaults.
   */
  async getSettings(): Promise<DataResult<UserSettings, SettingsRepositoryError | SettingsAuthenticationError>> {
    const userIdResult = await this.getCurrentUserId();
    if (!userIdResult.success) {
      return userIdResult;
    }

    return this.repository.getSettings(userIdResult.data);
  }

  /**
   * Update the main currency preference for the current user
   *
   * S-Tier: Includes referential integrity check to validate currency exists
   */
  async updateMainCurrency(
    currencyCode: string
  ): Promise<DataResult<UserSettings, SettingsRepositoryError | SettingsValidationError | SettingsAuthenticationError>> {
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

    // Delegate to repository
    return this.repository.updateMainCurrency(userId, normalizedCode);
  }

  /**
   * Update the transaction sort preference for the current user
   */
  async updateSortPreference(
    sortBy: 'date' | 'created_at'
  ): Promise<DataResult<UserSettings, SettingsRepositoryError | SettingsAuthenticationError>> {
    const userIdResult = await this.getCurrentUserId();
    if (!userIdResult.success) {
      return userIdResult;
    }

    return this.repository.updateSortPreference(userIdResult.data, sortBy);
  }

  /**
   * Update account visibility settings (batch operation)
   *
   * S-Tier: Batch operation for Native Bridge performance
   */
  async updateAccountVisibility(
    updates: { accountId: string; isVisible: boolean }[]
  ): Promise<DataResult<void, SettingsRepositoryError | SettingsAuthenticationError>> {
    const userIdResult = await this.getCurrentUserId();
    if (!userIdResult.success) {
      return userIdResult;
    }

    return this.repository.updateAccountVisibility(userIdResult.data, updates);
  }

  /**
   * Clear all user data (dangerous operation)
   *
   * Calls the `clear_user_data` RPC to delete all user-owned records.
   */
  async clearUserData(): Promise<DataResult<void, SettingsRepositoryError | SettingsAuthenticationError>> {
    const userIdResult = await this.getCurrentUserId();
    if (!userIdResult.success) {
      return userIdResult;
    }

    return this.repository.clearUserData(userIdResult.data);
  }
}

/**
 * Factory function to create UserSettingsService with proper DI.
 */
export function createUserSettingsService(supabase: SupabaseClient<Database>): UserSettingsService {
  const authProvider = createSupabaseAuthProvider(supabase);
  const repository = new SupabaseSettingsRepository(supabase);
  return new UserSettingsService(repository, authProvider);
}
