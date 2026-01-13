/**
 * Supabase Auth Provider Implementation
 *
 * Web implementation of IAuthProvider using Supabase Auth.
 *
 * @module supabase-auth-provider
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthenticationError, type IAuthProvider } from './auth-provider.interface';

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
  constructor(private readonly supabase: SupabaseClient) {}

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
