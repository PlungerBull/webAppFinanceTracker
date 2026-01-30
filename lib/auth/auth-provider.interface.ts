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

import type {
  AuthUserEntity,
  AuthSessionEntity,
  AuthStateChangeCallback,
  AuthUnsubscribe,
} from '@/domain/auth';

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
 *     func getUser() async throws -> AuthUserEntity?
 *     func getSession() async throws -> AuthSessionEntity?
 *     func updateUserMetadata(_ metadata: [String: Any]) async throws
 *     func onAuthStateChange(_ callback: @escaping AuthStateChangeCallback) -> AuthUnsubscribe
 * }
 * ```
 */
export interface IAuthProvider {
  // =========================================================================
  // EXISTING METHODS (Unchanged)
  // =========================================================================

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

  // =========================================================================
  // NEW UNIVERSAL METHODS (Auth Abstraction Parity)
  // =========================================================================

  /**
   * Get current authenticated user.
   *
   * GRACEFUL IDENTITY: Returns null if not authenticated (does not throw).
   * This prevents PGRST116 error loops when session is missing.
   *
   * @returns AuthUserEntity or null if not authenticated
   *
   * @example
   * ```typescript
   * const user = await authProvider.getUser();
   * if (user) {
   *   console.log(user.firstName);
   * }
   * ```
   *
   * Swift equivalent:
   * ```swift
   * if let user = try await authProvider.getUser() {
   *     print(user.firstName ?? "")
   * }
   * ```
   */
  getUser(): Promise<AuthUserEntity | null>;

  /**
   * Get current session.
   *
   * Returns null if no active session.
   *
   * @returns AuthSessionEntity or null if no session
   *
   * @example
   * ```typescript
   * const session = await authProvider.getSession();
   * if (session) {
   *   console.log(session.accessToken);
   * }
   * ```
   */
  getSession(): Promise<AuthSessionEntity | null>;

  /**
   * Update user metadata with atomic deep-merge.
   *
   * ATOMIC MERGE: Does NOT wipe existing metadata fields.
   * Only updates the fields provided in the metadata object.
   *
   * @param metadata - Partial metadata to merge
   *
   * @example
   * ```typescript
   * await authProvider.updateUserMetadata({ firstName: 'John' });
   * // lastName is preserved
   * ```
   */
  updateUserMetadata(metadata: Partial<{ firstName: string; lastName: string }>): Promise<void>;

  /**
   * Subscribe to auth state changes.
   *
   * EVENT STREAM FILTER: Filters redundant events to prevent unnecessary re-renders.
   * Returns unsubscribe function for cleanup.
   *
   * @param callback - Function called on auth state changes
   * @returns Unsubscribe function
   *
   * @example
   * ```typescript
   * const unsubscribe = authProvider.onAuthStateChange((event, session) => {
   *   console.log(event, session?.user.id);
   * });
   *
   * // Later: cleanup
   * unsubscribe();
   * ```
   */
  onAuthStateChange(callback: AuthStateChangeCallback): AuthUnsubscribe;
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
