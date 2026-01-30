/**
 * Supabase Auth Provider Implementation
 *
 * Web implementation of IAuthProvider using Supabase Auth.
 *
 * @module supabase-auth-provider
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthenticationError, type IAuthProvider } from './auth-provider.interface';
import type {
  AuthUserEntity,
  AuthSessionEntity,
  AuthStateChangeCallback,
  AuthUnsubscribe,
} from '@/domain/auth';
import {
  dbAuthUserToDomain,
  dbAuthSessionToDomain,
  dbAuthEventToDomain,
  domainMetadataToSupabase,
} from '@/lib/data/data-transformers';

/**
 * Supabase Auth Provider
 *
 * Implements IAuthProvider using Supabase Auth for web authentication.
 *
 * Swift Mirror (for iOS):
 * ```swift
 * class AppleAuthProvider: AuthProviderProtocol {
 *     func getCurrentUserId() async throws -> String {
 *         // Use Native Apple Sign-In
 *         let appleIDProvider = ASAuthorizationAppleIDProvider()
 *         let request = appleIDProvider.createRequest()
 *         request.requestedScopes = [.fullName, .email]
 *
 *         let controller = ASAuthorizationController(authorizationRequests: [request])
 *         // ... handle authorization
 *         return userCredential.user
 *     }
 *
 *     func isAuthenticated() async throws -> Bool {
 *         // Check if Apple ID credential is valid
 *         let provider = ASAuthorizationAppleIDProvider()
 *         let credentialState = try await provider.credentialState(forUserID: userId)
 *         return credentialState == .authorized
 *     }
 * }
 * ```
 */
export class SupabaseAuthProvider implements IAuthProvider {
  /**
   * Last event hash for redundant event filtering.
   * Prevents unnecessary re-renders from duplicate auth events.
   */
  private lastEventHash: string | null = null;

  constructor(private readonly supabase: SupabaseClient) {}

  // =========================================================================
  // EXISTING METHODS (Unchanged)
  // =========================================================================

  /**
   * Get current user ID from Supabase session.
   *
   * @returns User ID (UUID)
   * @throws {AuthenticationError} If user is not authenticated
   */
  async getCurrentUserId(): Promise<string> {
    const {
      data: { user },
      error,
    } = await this.supabase.auth.getUser();

    if (error) {
      throw new AuthenticationError(`Failed to get user: ${error.message}`);
    }

    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }

    return user.id;
  }

  /**
   * Check if user is currently authenticated.
   *
   * @returns true if user has valid session, false otherwise
   */
  async isAuthenticated(): Promise<boolean> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();

    return !!user;
  }

  /**
   * Sign out the current user.
   *
   * Clears Supabase session and removes auth cookies.
   */
  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();

    if (error) {
      throw new Error(`Failed to sign out: ${error.message}`);
    }
  }

  // =========================================================================
  // NEW UNIVERSAL METHODS (Auth Abstraction Parity)
  // =========================================================================

  /**
   * Get current authenticated user.
   *
   * GRACEFUL IDENTITY: Returns null if no session, never throws for missing auth.
   * This prevents PGRST116 error loops when session is missing.
   *
   * @returns AuthUserEntity or null if not authenticated
   */
  async getUser(): Promise<AuthUserEntity | null> {
    const {
      data: { user },
      error,
    } = await this.supabase.auth.getUser();

    // Graceful null for missing session - prevents PGRST116 loop
    if (
      error?.name === 'AuthSessionMissingError' ||
      error?.message?.includes('Auth session missing')
    ) {
      return null;
    }

    if (error) {
      throw new AuthenticationError(`Failed to get user: ${error.message}`);
    }

    if (!user) {
      return null;
    }

    // Use transformer for consistent mapping
    return dbAuthUserToDomain(user);
  }

  /**
   * Get current session.
   *
   * @returns AuthSessionEntity or null if no session
   */
  async getSession(): Promise<AuthSessionEntity | null> {
    const {
      data: { session },
      error,
    } = await this.supabase.auth.getSession();

    if (error) {
      throw new AuthenticationError(`Failed to get session: ${error.message}`);
    }

    if (!session) {
      return null;
    }

    // Use transformer for consistent mapping
    return dbAuthSessionToDomain(session);
  }

  /**
   * Update user metadata with atomic deep-merge.
   *
   * ATOMIC MERGE: Does NOT wipe existing metadata fields.
   * Fetches existing metadata first, then merges new values.
   *
   * @param metadata - Partial metadata to merge
   */
  async updateUserMetadata(
    metadata: Partial<{ firstName: string; lastName: string }>
  ): Promise<void> {
    // Fetch existing metadata for atomic merge
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    const existingMetadata = user?.user_metadata;

    // Use transformer for consistent metadata merging
    const mergedData = domainMetadataToSupabase(metadata, existingMetadata);

    const { error } = await this.supabase.auth.updateUser({ data: mergedData });

    if (error) {
      throw new AuthenticationError(`Failed to update metadata: ${error.message}`);
    }
  }

  /**
   * Subscribe to auth state changes.
   *
   * EVENT STREAM FILTER: Ignores redundant events to prevent unnecessary re-renders.
   * Uses hash-based deduplication of event + userId.
   *
   * @param callback - Function called on auth state changes
   * @returns Unsubscribe function
   */
  onAuthStateChange(callback: AuthStateChangeCallback): AuthUnsubscribe {
    const {
      data: { subscription },
    } = this.supabase.auth.onAuthStateChange((event, session) => {
      // Hash current state to detect redundant events
      const eventHash = JSON.stringify({ event, userId: session?.user?.id });
      if (eventHash === this.lastEventHash) {
        return; // Skip redundant event
      }
      this.lastEventHash = eventHash;

      // Use transformers for consistent mapping
      const mappedEvent = dbAuthEventToDomain(event);
      const mappedSession = session ? dbAuthSessionToDomain(session) : null;
      callback(mappedEvent, mappedSession);
    });

    return () => subscription.unsubscribe();
  }
}

/**
 * Factory function to create Supabase auth provider.
 *
 * @param supabase - Supabase client instance
 * @returns IAuthProvider implementation
 *
 * @example
 * ```typescript
 * import { createClient } from '@/lib/supabase/client';
 * import { createSupabaseAuthProvider } from '@/lib/auth';
 *
 * const authProvider = createSupabaseAuthProvider(createClient());
 * const userId = await authProvider.getCurrentUserId();
 * ```
 */
export function createSupabaseAuthProvider(supabase: SupabaseClient): IAuthProvider {
  return new SupabaseAuthProvider(supabase);
}
