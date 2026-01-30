/**
 * Auth Domain Entities
 *
 * Shared auth types for cross-feature use.
 * This is the "Sacred Domain" - any feature can import from here.
 *
 * CTO MANDATES:
 * - All fields readonly to prevent mutation outside service layer
 * - Metadata uses consistent firstName/lastName (no full_name concatenation leak)
 * - All dates are ISO 8601 strings
 *
 * @module domain/auth
 */

// ============================================================================
// AUTH USER ENTITY
// ============================================================================

/**
 * Auth User Entity
 *
 * Platform-agnostic user profile.
 * Abstracts Supabase User to avoid vendor lock-in.
 *
 * Swift Mirror:
 * ```swift
 * struct AuthUserEntity: Codable, Identifiable {
 *     let id: String
 *     let email: String?
 *     let firstName: String?
 *     let lastName: String?
 *     let createdAt: String
 * }
 * ```
 */
export interface AuthUserEntity {
  /** Primary key (UUID) */
  readonly id: string;

  /** User email address (null if not provided, e.g., Apple Sign-In without email sharing) */
  readonly email: string | null;

  /** First name from user metadata */
  readonly firstName: string | null;

  /** Last name from user metadata */
  readonly lastName: string | null;

  /** Account creation timestamp (ISO 8601) */
  readonly createdAt: string;
}

// ============================================================================
// AUTH SESSION ENTITY
// ============================================================================

/**
 * Auth Session Entity
 *
 * Platform-agnostic session representation.
 *
 * Swift Mirror:
 * ```swift
 * struct AuthSessionEntity: Codable {
 *     let accessToken: String
 *     let refreshToken: String?
 *     let expiresAt: Int
 *     let user: AuthUserEntity
 * }
 * ```
 */
export interface AuthSessionEntity {
  /** JWT access token for API authentication */
  readonly accessToken: string;

  /** Refresh token for session renewal (null if not applicable) */
  readonly refreshToken: string | null;

  /** Token expiration timestamp (Unix epoch seconds) */
  readonly expiresAt: number;

  /** Authenticated user entity */
  readonly user: AuthUserEntity;
}

// ============================================================================
// AUTH EVENT TYPES
// ============================================================================

/**
 * Auth Event Type
 *
 * Platform-agnostic auth state change events.
 */
export type AuthEventType =
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED';

/**
 * Auth State Change Callback
 *
 * Callback signature for auth state change subscriptions.
 */
export type AuthStateChangeCallback = (
  event: AuthEventType,
  session: AuthSessionEntity | null
) => void;

/**
 * Auth Unsubscribe Function
 *
 * Function to unsubscribe from auth state changes.
 */
export type AuthUnsubscribe = () => void;

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if user has email
 */
export function hasEmail(user: AuthUserEntity): user is AuthUserEntity & { email: string } {
  return user.email !== null;
}

/**
 * Type guard to check if user has full name (both first and last)
 */
export function hasFullName(
  user: AuthUserEntity
): user is AuthUserEntity & { firstName: string; lastName: string } {
  return user.firstName !== null && user.lastName !== null;
}

/**
 * Get display name from user entity
 *
 * Returns firstName + lastName if available, otherwise email prefix, otherwise 'User'
 */
export function getDisplayName(user: AuthUserEntity): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`.trim();
  }
  if (user.firstName) {
    return user.firstName;
  }
  if (user.email) {
    return user.email.split('@')[0];
  }
  return 'User';
}
