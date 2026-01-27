/**
 * Account Domain Types
 *
 * Data Transfer Objects (DTOs) and Result types for account operations.
 *
 * CTO MANDATES:
 * - DataResult<T> Pattern for explicit error handling
 * - Integer cents for all balance fields
 *
 * @module account-types
 */

import type { DataResult as SharedDataResult } from '@/lib/data-patterns';
import type { AccountError } from './errors';
import type { AccountViewEntity, AccountType } from './entities';

/**
 * Account-specific DataResult
 *
 * Uses AccountError for the error type.
 */
export type AccountDataResult<T> = SharedDataResult<T, AccountError>;

/**
 * Create Account DTO
 *
 * Input for creating a new account group with currencies.
 *
 * Swift Mirror:
 * ```swift
 * struct CreateAccountDTO: Codable {
 *     let id: String?         // Optional: Client-generated UUID for offline-first
 *     let name: String
 *     let type: AccountType
 *     let color: String
 *     let currencies: [String]
 * }
 * ```
 */
export interface CreateAccountDTO {
  /**
   * Optional client-generated UUID.
   *
   * CTO Mandate: For offline-first, clients must generate UUIDs.
   * If provided, this ID is used; otherwise, server generates one.
   */
  readonly id?: string;

  /** Account name (e.g., "Main Checking") */
  readonly name: string;

  /** Account type */
  readonly type: AccountType;

  /** Hex color code (e.g., "#3b82f6") */
  readonly color: string;

  /** Array of currency codes (e.g., ["USD", "EUR"]) */
  readonly currencies: string[];
}

/**
 * Update Account DTO
 *
 * Input for updating an existing account.
 *
 * Swift Mirror:
 * ```swift
 * struct UpdateAccountDTO: Codable {
 *     let name: String?
 *     let color: String?
 *     let isVisible: Bool?
 *     let version: Int
 * }
 * ```
 */
export interface UpdateAccountDTO {
  /** Updated account name */
  readonly name?: string;

  /** Updated hex color code */
  readonly color?: string;

  /** Updated visibility */
  readonly isVisible?: boolean;

  /** Version for optimistic concurrency control */
  readonly version: number;
}

/**
 * Create Account Group Result
 *
 * Response from creating an account group.
 *
 * Swift Mirror:
 * ```swift
 * struct CreateAccountGroupResult: Codable {
 *     let groupId: String
 *     let accounts: [AccountViewEntity]
 * }
 * ```
 */
export interface CreateAccountGroupResult {
  /** Group ID linking all created accounts */
  readonly groupId: string;

  /** Array of created accounts (one per currency) */
  readonly accounts: AccountViewEntity[];
}

/**
 * Account Filters
 *
 * Query filters for fetching accounts.
 */
export interface AccountFilters {
  /** Filter by account type */
  readonly type?: AccountType;

  /** Filter by visibility */
  readonly isVisible?: boolean;

  /** Filter by group ID */
  readonly groupId?: string;

  /** Include soft-deleted accounts */
  readonly includeDeleted?: boolean;
}
