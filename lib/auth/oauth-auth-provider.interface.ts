/**
 * OAuth Auth Provider Interface
 *
 * CTO Mandate #6: Auth Provider Abstraction (Multi-Platform Support)
 *
 * This interface abstracts OAuth/OIDC authentication operations.
 * iOS implements this with Apple Sign-In. Web may implement this
 * for Google OAuth in the future.
 *
 * Design:
 * - All methods return DataResult<T, OAuthAuthError> (no throws)
 * - Error codes are platform-agnostic for consistent UI handling
 * - Swift can mirror with Result<T, OAuthAuthError>
 *
 * Platform Configuration:
 * - iOS: Implements with Apple Sign-In (primary auth method)
 * - Web: May implement for Google OAuth (optional, future)
 *
 * Swift Mirror:
 * ```swift
 * protocol OAuthAuthProviderProtocol {
 *     var availableProviders: [OAuthProvider] { get }
 *     func signInWithApple(_ data: OAuthSignInData) async -> Result<SignInResult, OAuthAuthError>
 *     func isAvailable() -> Bool
 * }
 *
 * enum OAuthProvider: String, Codable {
 *     case apple
 *     case google
 * }
 * ```
 *
 * @module oauth-auth-provider
 */

import type { DataResult } from '@/lib/data-patterns/types';
import type {
  SignInResult,
  OAuthSignInData,
  OAuthAuthError,
} from '@/domain/auth';

// ============================================================================
// OAUTH PROVIDER TYPE
// ============================================================================

/**
 * Supported OAuth Providers
 */
export type OAuthProvider = 'apple' | 'google';

// ============================================================================
// OAUTH AUTH PROVIDER INTERFACE
// ============================================================================

/**
 * OAuth Auth Provider Interface
 *
 * Provides OAuth/OIDC authentication operations.
 * iOS uses this with Apple Sign-In.
 *
 * All methods return DataResult for explicit error handling.
 */
export interface IOAuthAuthProvider {
  /**
   * Available OAuth providers on this platform.
   *
   * Returns an array of provider identifiers that can be used for sign-in.
   * UI should check this to conditionally render sign-in buttons.
   *
   * @example
   * ```typescript
   * if (oauthProvider.availableProviders.includes('apple')) {
   *   showAppleSignInButton();
   * }
   * ```
   */
  readonly availableProviders: readonly OAuthProvider[];

  /**
   * Sign in with Apple.
   *
   * Handles both new user registration and existing user sign-in.
   * Apple provides identity token which is verified server-side.
   *
   * iOS Implementation:
   * 1. Present ASAuthorizationController
   * 2. Receive ASAuthorizationAppleIDCredential
   * 3. Extract identityToken, firstName, lastName (first sign-in only)
   * 4. Call this method with OAuthSignInData
   * 5. Server verifies token with Apple and creates/updates user
   *
   * @param data - OAuth sign-in data from Apple
   * @returns DataResult with SignInResult on success
   *
   * Error codes:
   * - CANCELLED: User cancelled sign-in flow
   * - INVALID_TOKEN: Identity token validation failed
   * - NOT_AVAILABLE: Apple Sign-In not available on device
   * - NETWORK_ERROR: Network connectivity issue
   * - UNKNOWN_ERROR: Unexpected error
   */
  signInWithApple(
    data: OAuthSignInData
  ): Promise<DataResult<SignInResult, OAuthAuthError>>;

  /**
   * Sign in with Google (future).
   *
   * Similar flow to Apple Sign-In but with Google Identity Services.
   *
   * @param data - OAuth sign-in data from Google
   * @returns DataResult with SignInResult on success
   */
  signInWithGoogle?(
    data: OAuthSignInData
  ): Promise<DataResult<SignInResult, OAuthAuthError>>;

  /**
   * Check if OAuth authentication is available on this platform.
   *
   * Returns false if:
   * - Platform doesn't support any OAuth providers
   * - Required native frameworks are unavailable
   * - Device restrictions prevent OAuth sign-in
   *
   * @returns true if at least one OAuth provider is available
   */
  isAvailable(): boolean;
}
