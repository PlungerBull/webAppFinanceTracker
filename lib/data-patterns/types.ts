/**
 * Shared Data Patterns
 *
 * Cross-feature types for repository pattern operations.
 * These types are shared across ALL features (Transactions, Accounts, Inbox, Transfers).
 *
 * CTO MANDATES:
 * 1. Keep structures simple and serializable for Swift Result<T, Error> compatibility
 * 2. No class instances in error fields - use plain objects
 * 3. Document Swift equivalents for iOS team
 *
 * @module data-patterns
 */

/**
 * Generic Error Shape (Serializable)
 *
 * Used in DataResult for cross-platform compatibility.
 * Avoid class instances - use plain objects.
 *
 * Swift Mirror:
 * ```swift
 * struct DomainError: Codable, Error {
 *     let code: String
 *     let message: String
 * }
 * ```
 */
export interface SerializableError {
  readonly code: string;
  readonly message: string;
}

/**
 * DataResult Pattern (Swift Result<T, Error> Mirror)
 *
 * CTO Mandate: Explicit Success/Failure Types
 *
 * Repository methods return DataResult<T> instead of throwing.
 * Forces explicit error handling at service layer.
 *
 * Benefits:
 * - Forces explicit error handling at service layer
 * - iOS can mirror with Swift's Result<T, DomainError>
 * - Conflict detection is type-safe (conflict?: boolean)
 * - No ambiguity about error states
 *
 * Swift Mirror:
 * ```swift
 * enum DataResult<T: Codable> {
 *     case success(T, conflict: Bool?)
 *     case failure(DomainError, conflict: Bool?)
 * }
 * ```
 *
 * Usage:
 * ```typescript
 * // Repository returns DataResult
 * const result = await repository.getById(userId, id);
 *
 * // Service checks explicitly
 * if (!result.success) {
 *   if (result.conflict) { // retry logic }
 *   throw result.error;
 * }
 * return result.data;
 * ```
 */
export type DataResult<T, E extends Error | SerializableError = Error> =
  | { success: true; data: T; conflict?: boolean; buffered?: boolean; bufferedCount?: number }
  | { success: false; data: null; error: E; conflict?: boolean };

/**
 * Pagination Options
 *
 * Offset/limit pagination for queries.
 *
 * Swift Mirror:
 * ```swift
 * struct PaginationOptions: Codable {
 *     let offset: Int
 *     let limit: Int
 * }
 * ```
 */
export interface PaginationOptions {
  /** Number of records to skip */
  readonly offset: number;

  /** Maximum number of records to return */
  readonly limit: number;
}

/**
 * Paginated Result
 *
 * Generic paginated response.
 *
 * Swift Mirror:
 * ```swift
 * struct PaginatedResult<T: Codable>: Codable {
 *     let data: [T]
 *     let total: Int
 *     let offset: Int
 *     let limit: Int
 *     let hasMore: Bool
 * }
 * ```
 */
export interface PaginatedResult<T> {
  /** Array of items for current page */
  readonly data: T[];

  /** Total number of items (across all pages) */
  readonly total: number;

  /** Current offset */
  readonly offset: number;

  /** Current limit */
  readonly limit: number;

  /** Whether there are more pages available */
  readonly hasMore: boolean;
}

/**
 * Sync Response (Version-Based Delta Sync)
 *
 * CTO Mandate: Version-Based Sync (NOT Timestamps)
 *
 * How it works:
 * 1. Client stores last sync version: localStorage.setItem('lastSyncVersion', '12345')
 * 2. Client requests changes: getChangesSince(userId, 12345)
 * 3. Server returns: all records where version > 12345 + currentServerVersion
 * 4. Client updates: localStorage.setItem('lastSyncVersion', currentServerVersion)
 *
 * Swift Mirror:
 * ```swift
 * struct SyncResponse<T: Codable>: Codable {
 *     let data: T
 *     let currentServerVersion: Int
 *     let hasMore: Bool
 * }
 * ```
 */
export interface SyncResponse<T> {
  /** Response data (transactions, accounts, etc.) */
  readonly data: T;

  /**
   * Current server version (monotonic counter)
   *
   * CRITICAL: Client MUST store this value for next sync
   */
  readonly currentServerVersion: number;

  /** Whether there are more changes available (for pagination) */
  readonly hasMore: boolean;
}
