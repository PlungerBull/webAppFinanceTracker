/**
 * Account Service Interface
 *
 * Defines the contract for account business logic operations.
 * Service layer is responsible for:
 * - Auth context extraction
 * - Business validation
 * - Error translation (DataResult -> throw)
 *
 * @module account-service-interface
 */

import type {
  CreateAccountDTO,
  UpdateAccountDTO,
  CreateAccountGroupResult,
  AccountFilters,
  AccountViewEntity,
} from '../domain';

/**
 * Account Service Interface
 *
 * Swift Mirror:
 * ```swift
 * protocol AccountServiceProtocol {
 *     func getAll(filters: AccountFilters?) async throws -> [AccountViewEntity]
 *     func getById(id: String) async throws -> AccountViewEntity
 *     func getByGroupId(groupId: String) async throws -> [AccountViewEntity]
 *     func create(data: CreateAccountDTO) async throws -> CreateAccountGroupResult
 *     func update(id: String, data: UpdateAccountDTO) async throws -> AccountViewEntity
 *     func delete(id: String) async throws
 * }
 * ```
 */
export interface IAccountService {
  /**
   * Get all accounts for the current user.
   *
   * @param filters - Optional filters
   * @returns Array of accounts
   * @throws {AccountError} If fetch fails
   */
  getAll(filters?: AccountFilters): Promise<AccountViewEntity[]>;

  /**
   * Get a single account by ID.
   *
   * @param id - Account ID
   * @returns Account entity
   * @throws {AccountNotFoundError} If account not found
   * @throws {AccountError} If fetch fails
   */
  getById(id: string): Promise<AccountViewEntity>;

  /**
   * Get all accounts in a group.
   *
   * @param groupId - Account group ID
   * @returns Array of accounts in the group
   * @throws {AccountError} If fetch fails
   */
  getByGroupId(groupId: string): Promise<AccountViewEntity[]>;

  /**
   * Create a new account group with currencies.
   *
   * @param data - Account creation data
   * @returns Created accounts result
   * @throws {AccountValidationError} If data is invalid
   * @throws {AccountError} If creation fails
   */
  create(data: CreateAccountDTO): Promise<CreateAccountGroupResult>;

  /**
   * Update an existing account.
   *
   * @param id - Account ID
   * @param data - Update data
   * @returns Updated account entity
   * @throws {AccountNotFoundError} If account not found
   * @throws {AccountVersionConflictError} If version conflict
   * @throws {AccountError} If update fails
   */
  update(id: string, data: UpdateAccountDTO): Promise<AccountViewEntity>;

  /**
   * Soft delete an account (Tombstone Pattern).
   *
   * CTO Mandate: Uses soft delete for distributed sync compatibility.
   *
   * @param id - Account ID
   * @param version - Expected version for optimistic concurrency control
   * @throws {AccountNotFoundError} If account not found
   * @throws {AccountVersionConflictError} If version conflict
   * @throws {AccountError} If deletion fails
   */
  delete(id: string, version: number): Promise<void>;
}
