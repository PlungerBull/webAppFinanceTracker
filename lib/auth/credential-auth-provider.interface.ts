/**
 * Credential Auth Provider Interface
 *
 * CTO Mandate #6: Auth Provider Abstraction (Multi-Platform Support)
 *
 * This interface abstracts email/password authentication operations.
 * Web implements this with Supabase. iOS does NOT implement this interface
 * (iOS uses IOAuthAuthProvider with Apple Sign-In instead).
 *
 * Design:
 * - All methods return DataResult<T, CredentialAuthError> (no throws)
 * - Error codes are platform-agnostic for consistent UI handling
 * - Swift can mirror with Result<T, CredentialAuthError>
 *
 * Swift Mirror:
 * ```swift
 * protocol CredentialAuthProviderProtocol {
 *     func signUp(_ data: SignUpData) async -> Result<SignUpResult, CredentialAuthError>
 *     func signIn(_ data: SignInData) async -> Result<SignInResult, CredentialAuthError>
 *     func resetPassword(_ data: ResetPasswordData) async -> Result<Void, CredentialAuthError>
 *     func updatePassword(_ data: UpdatePasswordData) async -> Result<Void, CredentialAuthError>
 *     func changePassword(_ data: ChangePasswordData) async -> Result<Void, CredentialAuthError>
 *     func changeEmail(_ data: ChangeEmailData) async -> Result<Void, CredentialAuthError>
 * }
 * ```
 *
 * @module credential-auth-provider
 */

import type { DataResult } from '@/lib/data-patterns/types';
import type {
  SignUpResult,
  SignInResult,
  CredentialAuthError,
} from '@/domain/auth';

// ============================================================================
// INPUT DATA TYPES
// ============================================================================

/**
 * Sign-Up Input Data
 *
 * Data required to create a new user account with email/password.
 */
export interface CredentialSignUpData {
  readonly email: string;
  readonly password: string;
  readonly firstName: string;
  readonly lastName: string;
}

/**
 * Sign-In Input Data
 *
 * Data required to sign in with email/password.
 */
export interface CredentialSignInData {
  readonly email: string;
  readonly password: string;
}

/**
 * Reset Password Input Data
 *
 * Data required to send a password reset email.
 */
export interface ResetPasswordData {
  readonly email: string;
  readonly redirectTo?: string;
}

/**
 * Update Password Input Data
 *
 * Data required to update password after reset (user is already authenticated via reset link).
 */
export interface UpdatePasswordData {
  readonly newPassword: string;
}

/**
 * Change Password Input Data
 *
 * Data required to change password (requires reauthentication).
 */
export interface ChangePasswordData {
  readonly newPassword: string;
}

/**
 * Change Email Input Data
 *
 * Data required to change email (requires reauthentication).
 */
export interface ChangeEmailData {
  readonly newEmail: string;
  readonly redirectTo?: string;
}

// ============================================================================
// CREDENTIAL AUTH PROVIDER INTERFACE
// ============================================================================

/**
 * Credential Auth Provider Interface
 *
 * Provides email/password authentication operations.
 * Web uses this with Supabase. iOS does NOT implement this interface.
 *
 * All methods return DataResult for explicit error handling.
 */
export interface ICredentialAuthProvider {
  /**
   * Sign up a new user with email and password.
   *
   * May require email confirmation depending on server configuration.
   * Check `needsEmailConfirmation` in result to determine UI flow.
   *
   * @param data - Sign-up credentials and user info
   * @returns DataResult with SignUpResult on success
   *
   * Error codes:
   * - EMAIL_ALREADY_EXISTS: Email is already registered
   * - WEAK_PASSWORD: Password doesn't meet requirements
   * - RATE_LIMITED: Too many sign-up attempts
   * - NETWORK_ERROR: Network connectivity issue
   * - UNKNOWN_ERROR: Unexpected error
   */
  signUp(data: CredentialSignUpData): Promise<DataResult<SignUpResult, CredentialAuthError>>;

  /**
   * Sign in with email and password.
   *
   * @param data - Sign-in credentials
   * @returns DataResult with SignInResult on success
   *
   * Error codes:
   * - INVALID_CREDENTIALS: Email or password is incorrect
   * - EMAIL_NOT_CONFIRMED: User hasn't confirmed email
   * - RATE_LIMITED: Too many sign-in attempts
   * - NETWORK_ERROR: Network connectivity issue
   * - UNKNOWN_ERROR: Unexpected error
   */
  signIn(data: CredentialSignInData): Promise<DataResult<SignInResult, CredentialAuthError>>;

  /**
   * Send password reset email.
   *
   * @param data - Email and optional redirect URL
   * @returns DataResult with void on success
   *
   * Note: Always returns success even if email doesn't exist
   * (security: prevents email enumeration attacks)
   *
   * Error codes:
   * - RATE_LIMITED: Too many reset attempts
   * - NETWORK_ERROR: Network connectivity issue
   * - UNKNOWN_ERROR: Unexpected error
   */
  resetPassword(data: ResetPasswordData): Promise<DataResult<void, CredentialAuthError>>;

  /**
   * Update password after reset.
   *
   * User must be authenticated via password reset link before calling this.
   *
   * @param data - New password
   * @returns DataResult with void on success
   *
   * Error codes:
   * - WEAK_PASSWORD: Password doesn't meet requirements
   * - NETWORK_ERROR: Network connectivity issue
   * - UNKNOWN_ERROR: Unexpected error
   */
  updatePassword(data: UpdatePasswordData): Promise<DataResult<void, CredentialAuthError>>;

  /**
   * Change password (requires reauthentication).
   *
   * Triggers reauthentication flow before allowing password change.
   * Used when user wants to change password from settings.
   *
   * @param data - New password
   * @returns DataResult with void on success
   *
   * Error codes:
   * - REAUTHENTICATION_FAILED: User couldn't be reauthenticated
   * - WEAK_PASSWORD: Password doesn't meet requirements
   * - NETWORK_ERROR: Network connectivity issue
   * - UNKNOWN_ERROR: Unexpected error
   */
  changePassword(data: ChangePasswordData): Promise<DataResult<void, CredentialAuthError>>;

  /**
   * Change email (requires reauthentication).
   *
   * Triggers reauthentication flow before allowing email change.
   * Sends confirmation email to new address.
   *
   * @param data - New email and optional redirect URL
   * @returns DataResult with void on success
   *
   * Error codes:
   * - REAUTHENTICATION_FAILED: User couldn't be reauthenticated
   * - EMAIL_ALREADY_EXISTS: New email is already registered
   * - NETWORK_ERROR: Network connectivity issue
   * - UNKNOWN_ERROR: Unexpected error
   */
  changeEmail(data: ChangeEmailData): Promise<DataResult<void, CredentialAuthError>>;
}
