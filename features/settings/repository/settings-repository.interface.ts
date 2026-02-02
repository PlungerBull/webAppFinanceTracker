/**
 * Settings Repository Interface
 *
 * Defines the contract for user settings data access operations.
 * Repository layer is responsible for:
 * - Supabase queries
 * - Data transformation (snake_case <-> camelCase)
 * - DataResult wrapping (never throws)
 *
 * Note: Authentication errors are NOT handled at repository level.
 * The service layer is responsible for obtaining userId before calling repository.
 *
 * @module features/settings/repository
 */

import type { DataResult } from '@/lib/data-patterns';
import type { UserSettings } from '@/types/domain';
import type {
  SettingsRepositoryError,
  SettingsNotFoundError,
} from '../domain/errors';

/**
 * Settings Repository Interface
 *
 * Swift Mirror:
 * ```swift
 * protocol SettingsRepositoryProtocol {
 *     func getSettings(userId: String) async -> DataResult<UserSettings>
 *     func updateMainCurrency(userId: String, currencyCode: String) async -> DataResult<UserSettings>
 *     func updateSortPreference(userId: String, sortBy: TransactionSortMode) async -> DataResult<UserSettings>
 *     func updateAccountVisibility(userId: String, updates: [AccountVisibilityUpdate]) async -> DataResult<Void>
 *     func clearUserData(userId: String) async -> DataResult<Void>
 * }
 * ```
 */
export interface ISettingsRepository {
  /**
   * Get user settings for a user.
   *
   * @param userId - User ID
   * @returns DataResult with user settings
   */
  getSettings(
    userId: string
  ): Promise<DataResult<UserSettings, SettingsRepositoryError | SettingsNotFoundError>>;

  /**
   * Update the main currency preference.
   *
   * Note: This is a raw update. Currency validation happens in service layer.
   *
   * @param userId - User ID
   * @param currencyCode - Currency code (e.g., "USD", "EUR")
   * @returns DataResult with updated settings
   */
  updateMainCurrency(
    userId: string,
    currencyCode: string
  ): Promise<DataResult<UserSettings, SettingsRepositoryError>>;

  /**
   * Update the transaction sort preference.
   *
   * @param userId - User ID
   * @param sortBy - Sort preference ('date' or 'created_at')
   * @returns DataResult with updated settings
   */
  updateSortPreference(
    userId: string,
    sortBy: 'date' | 'created_at'
  ): Promise<DataResult<UserSettings, SettingsRepositoryError>>;

  /**
   * Update account visibility settings (batch operation).
   *
   * S-Tier: Batch operation for Native Bridge performance.
   *
   * @param userId - User ID
   * @param updates - Array of account visibility updates
   * @returns DataResult with void on success
   */
  updateAccountVisibility(
    userId: string,
    updates: { accountId: string; isVisible: boolean }[]
  ): Promise<DataResult<void, SettingsRepositoryError>>;

  /**
   * Clear all user data (dangerous operation).
   *
   * Calls the `clear_user_data` RPC to delete all user-owned records.
   *
   * @param userId - User ID
   * @returns DataResult with void on success
   */
  clearUserData(
    userId: string
  ): Promise<DataResult<void, SettingsRepositoryError>>;
}
