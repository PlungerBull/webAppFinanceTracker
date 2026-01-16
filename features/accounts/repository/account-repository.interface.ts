/**
 * Account Repository Interface
 *
 * Defines the contract for account data access operations.
 * Repository layer is responsible for:
 * - Supabase queries
 * - Data transformation (snake_case <-> camelCase)
 * - Decimal <-> Integer cents conversion
 * - DataResult wrapping (never throws)
 *
 * @module account-repository-interface
 */

import type {
  AccountDataResult,
  CreateAccountDTO,
  UpdateAccountDTO,
  CreateAccountGroupResult,
  AccountFilters,
  AccountViewEntity,
} from '../domain';

/**
 * Account Repository Interface
 *
 * Swift Mirror:
 * ```swift
 * protocol AccountRepositoryProtocol {
 *     func getAll(userId: String) async -> DataResult<[AccountViewEntity]>
 *     func getById(userId: String, id: String) async -> DataResult<AccountViewEntity>
 *     func getByGroupId(userId: String, groupId: String) async -> DataResult<[AccountViewEntity]>
 *     func createWithCurrencies(userId: String, data: CreateAccountDTO) async -> DataResult<CreateAccountGroupResult>
 *     func update(userId: String, id: String, data: UpdateAccountDTO) async -> DataResult<AccountViewEntity>
 *     func delete(userId: String, id: String, version: Int) async -> DataResult<Void>
 * }
 * ```
 */
export interface IAccountRepository {
  /**
   * Get all accounts for a user.
   *
   * @param userId - User ID
   * @param filters - Optional filters
   * @returns DataResult with array of accounts
   */
  getAll(
    userId: string,
    filters?: AccountFilters
  ): Promise<AccountDataResult<AccountViewEntity[]>>;

  /**
   * Get a single account by ID.
   *
   * @param userId - User ID (for RLS verification)
   * @param id - Account ID
   * @returns DataResult with account entity
   */
  getById(
    userId: string,
    id: string
  ): Promise<AccountDataResult<AccountViewEntity>>;

  /**
   * Get all accounts in a group.
   *
   * @param userId - User ID
   * @param groupId - Account group ID
   * @returns DataResult with array of accounts in the group
   */
  getByGroupId(
    userId: string,
    groupId: string
  ): Promise<AccountDataResult<AccountViewEntity[]>>;

  /**
   * Create a new account group with multiple currencies.
   *
   * Uses RPC for atomic multi-account creation.
   *
   * @param userId - User ID
   * @param data - Account creation data
   * @returns DataResult with created accounts
   */
  createWithCurrencies(
    userId: string,
    data: CreateAccountDTO
  ): Promise<AccountDataResult<CreateAccountGroupResult>>;

  /**
   * Update an existing account.
   *
   * @param userId - User ID (for RLS verification)
   * @param id - Account ID
   * @param data - Update data with version for concurrency control
   * @returns DataResult with updated account entity
   */
  update(
    userId: string,
    id: string,
    data: UpdateAccountDTO
  ): Promise<AccountDataResult<AccountViewEntity>>;

  /**
   * Delete an account.
   *
   * NOTE: Currently uses hard delete. May be changed to soft delete
   * for offline sync compatibility in the future.
   *
   * @param userId - User ID (for RLS verification)
   * @param id - Account ID
   * @returns DataResult with void on success
   */
  delete(
    userId: string,
    id: string
  ): Promise<AccountDataResult<void>>;
}
