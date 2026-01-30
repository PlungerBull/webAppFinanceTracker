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

import type { SerializableError } from '@/lib/data-patterns/types';

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

// ============================================================================
// AUTH METHOD TYPES (Multi-Platform Authentication)
// ============================================================================

/**
 * Supported authentication methods
 *
 * Swift Mirror:
 * ```swift
 * enum AuthMethod: String, Codable {
 *     case credential
 *     case oauthApple = "oauth_apple"
 *     case oauthGoogle = "oauth_google"
 * }
 * ```
 */
export type AuthMethod = 'credential' | 'oauth_apple' | 'oauth_google';

// ============================================================================
// SIGN-IN/SIGN-UP RESULT TYPES
// ============================================================================

/**
 * Sign-In Result
 *
 * Platform-agnostic result of a successful sign-in operation.
 * Both credential and OAuth flows return this type.
 *
 * Swift Mirror:
 * ```swift
 * struct SignInResult: Codable {
 *     let user: AuthUserEntity
 *     let session: AuthSessionEntity
 *     let isNewUser: Bool
 * }
 * ```
 */
export interface SignInResult {
  /** Authenticated user entity */
  readonly user: AuthUserEntity;

  /** Active session with tokens */
  readonly session: AuthSessionEntity;

  /** True if this is a new user registration (OAuth only) */
  readonly isNewUser: boolean;
}

/**
 * Sign-Up Result
 *
 * Result of credential-based sign-up. May require email confirmation.
 *
 * Swift Mirror:
 * ```swift
 * struct SignUpResult: Codable {
 *     let user: AuthUserEntity?
 *     let session: AuthSessionEntity?
 *     let needsEmailConfirmation: Bool
 * }
 * ```
 */
export interface SignUpResult {
  /** User entity (null if email confirmation required) */
  readonly user: AuthUserEntity | null;

  /** Session (null if email confirmation required) */
  readonly session: AuthSessionEntity | null;

  /** True if user must confirm email before sign-in */
  readonly needsEmailConfirmation: boolean;
}

// ============================================================================
// CREDENTIAL AUTH ERROR TYPES
// ============================================================================

/**
 * Credential Error Codes
 *
 * Platform-agnostic error codes for credential-based authentication.
 *
 * Swift Mirror:
 * ```swift
 * enum CredentialErrorCode: String, Codable {
 *     case invalidCredentials = "INVALID_CREDENTIALS"
 *     case emailNotConfirmed = "EMAIL_NOT_CONFIRMED"
 *     case emailAlreadyExists = "EMAIL_ALREADY_EXISTS"
 *     case weakPassword = "WEAK_PASSWORD"
 *     case rateLimited = "RATE_LIMITED"
 *     case reauthenticationFailed = "REAUTHENTICATION_FAILED"
 *     case networkError = "NETWORK_ERROR"
 *     case unknownError = "UNKNOWN_ERROR"
 * }
 * ```
 */
export type CredentialErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_NOT_CONFIRMED'
  | 'EMAIL_ALREADY_EXISTS'
  | 'WEAK_PASSWORD'
  | 'RATE_LIMITED'
  | 'REAUTHENTICATION_FAILED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * Credential Auth Error
 *
 * Error type for credential-based authentication operations.
 * Implements SerializableError for cross-platform compatibility.
 *
 * Swift Mirror:
 * ```swift
 * struct CredentialAuthError: Codable, Error {
 *     let code: CredentialErrorCode
 *     let message: String
 * }
 * ```
 */
export interface CredentialAuthError extends SerializableError {
  readonly code: CredentialErrorCode;
}

// ============================================================================
// OAUTH AUTH ERROR TYPES
// ============================================================================

/**
 * OAuth Error Codes
 *
 * Platform-agnostic error codes for OAuth authentication.
 *
 * Swift Mirror:
 * ```swift
 * enum OAuthErrorCode: String, Codable {
 *     case cancelled = "CANCELLED"
 *     case invalidToken = "INVALID_TOKEN"
 *     case notAvailable = "NOT_AVAILABLE"
 *     case networkError = "NETWORK_ERROR"
 *     case unknownError = "UNKNOWN_ERROR"
 * }
 * ```
 */
export type OAuthErrorCode =
  | 'CANCELLED'
  | 'INVALID_TOKEN'
  | 'NOT_AVAILABLE'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * OAuth Auth Error
 *
 * Error type for OAuth authentication operations.
 * Implements SerializableError for cross-platform compatibility.
 *
 * Swift Mirror:
 * ```swift
 * struct OAuthAuthError: Codable, Error {
 *     let code: OAuthErrorCode
 *     let message: String
 * }
 * ```
 */
export interface OAuthAuthError extends SerializableError {
  readonly code: OAuthErrorCode;
}

// ============================================================================
// OAUTH SIGN-IN DATA
// ============================================================================

/**
 * OAuth Sign-In Data
 *
 * Data provided by OAuth provider (Apple/Google) for sign-in.
 *
 * Swift Mirror:
 * ```swift
 * struct OAuthSignInData: Codable {
 *     let identityToken: String
 *     let nonce: String?
 *     let firstName: String?
 *     let lastName: String?
 * }
 * ```
 */
export interface OAuthSignInData {
  /** JWT identity token from OAuth provider */
  readonly identityToken: string;

  /** Nonce for replay protection (Apple Sign-In) */
  readonly nonce?: string;

  /** First name (only provided on first sign-in with Apple) */
  readonly firstName?: string;

  /** Last name (only provided on first sign-in with Apple) */
  readonly lastName?: string;
}
