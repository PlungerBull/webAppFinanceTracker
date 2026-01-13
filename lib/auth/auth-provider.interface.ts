/**
 * Auth Provider Interface
 *
 * CTO Mandate #6: Auth Provider Abstraction (Native Apple Sign-In Support)
 *
 * Problem: Service layer calls `supabase.auth.getUser()` directly - won't work
 *          with iOS Native Apple Auth.
 * Solution: Create `IAuthProvider` interface that both platforms implement.
 *
 * Cross-Platform Implementation:
 * - Web: SupabaseAuthProvider (uses Supabase Auth)
 * - iOS: AppleAuthProvider (uses Native Apple Sign-In)
 *
 * @module auth-provider
 */

/**
 * Auth Provider Interface
 *
 * Provides platform-agnostic authentication operations.
 * The service layer depends on this interface, not on specific implementations.
 *
 * Swift Mirror:
 * ```swift
 * protocol AuthProviderProtocol {
 *     func getCurrentUserId() async throws -> String
 *     func isAuthenticated() async throws -> Bool
 *     func signOut() async throws
 * }
 * ```
 */
export interface IAuthProvider {
  /**
   * Get the currently authenticated user's ID.
   *
   * @returns User ID (UUID string)
   * @throws {Error} If user is not authenticated
   *
   * @example
   * ```typescript
   * const userId = await authProvider.getCurrentUserId();
   * ```
   *
   * Swift equivalent:
   * ```swift
   * let userId = try await authProvider.getCurrentUserId()
   * ```
   */
  getCurrentUserId(): Promise<string>;

  /**
   * Check if a user is currently authenticated.
   *
   * @returns true if authenticated, false otherwise
   *
   * @example
   * ```typescript
   * if (await authProvider.isAuthenticated()) {
   *   // User is signed in
   * }
   * ```
   *
   * Swift equivalent:
   * ```swift
   * if try await authProvider.isAuthenticated() {
   *     // User is signed in
   * }
   * ```
   */
  isAuthenticated(): Promise<boolean>;

  /**
   * Sign out the current user.
   *
   * Optional method - not all platforms may support programmatic sign out.
   *
   * @example
   * ```typescript
   * await authProvider.signOut();
   * ```
   *
   * Swift equivalent:
   * ```swift
   * try await authProvider.signOut()
   * ```
   */
  signOut?(): Promise<void>;
}

/**
 * Auth Error
 *
 * Thrown when authentication operations fail.
 */
export class AuthenticationError extends Error {
  constructor(message: string = 'User not authenticated') {
    super(message);
    this.name = 'AuthenticationError';
  }
}
