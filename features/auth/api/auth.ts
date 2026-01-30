/**
 * Auth API
 *
 * Provides authentication operations with IOC injection pattern.
 *
 * ARCHITECTURE:
 * - Universal operations (getUser, getSession, logout, updateUserMetadata) route through IAuthProvider
 * - Credential operations (signUp, login, resetPassword, etc.) route through ICredentialAuthProvider
 * - OAuth operations (signInWithApple) route through IOAuthAuthProvider
 *
 * IOC PATTERN:
 * - Factory `createAuthApi` accepts providers as dependencies
 * - Singleton initialized at composition root (providers/auth-provider.tsx)
 * - Platform configuration:
 *   - Web: IAuthProvider + ICredentialAuthProvider
 *   - iOS: IAuthProvider + IOAuthAuthProvider
 *
 * @module auth-api
 */

import type { IAuthProvider } from '@/lib/auth/auth-provider.interface';
import type { ICredentialAuthProvider } from '@/lib/auth/credential-auth-provider.interface';
import type { IOAuthAuthProvider } from '@/lib/auth/oauth-auth-provider.interface';
import type { AuthUserEntity, AuthSessionEntity, AuthMethod } from '@/domain/auth';
import type {
  UpdateProfileFormData,
} from '@/features/auth/schemas/profile.schema';

// ============================================================================
// AUTH API FACTORY (IOC Injection)
// ============================================================================

/**
 * Auth API type definition
 *
 * Multi-provider architecture:
 * - Identity operations (getUser, getSession, etc.) - all platforms
 * - Credential operations (signUp, login, etc.) - web only via ICredentialAuthProvider
 * - OAuth operations (signInWithApple) - iOS primarily via IOAuthAuthProvider
 */
export interface AuthApi {
  // =========================================================================
  // IDENTITY OPERATIONS (IAuthProvider - all platforms)
  // =========================================================================
  getUser: () => Promise<AuthUserEntity | null>;
  getSession: () => Promise<AuthSessionEntity | null>;
  logout: () => Promise<void>;
  updateUserMetadata: (data: UpdateProfileFormData) => Promise<void>;

  // =========================================================================
  // CREDENTIAL OPERATIONS (ICredentialAuthProvider - web only)
  // =========================================================================
  /**
   * Credential auth provider for email/password operations.
   * Returns null on platforms that don't support credential auth (e.g., iOS).
   *
   * @example
   * ```typescript
   * const result = await getAuthApi().credential?.signIn({ email, password });
   * if (result?.success) {
   *   router.push('/dashboard');
   * }
   * ```
   */
  credential: ICredentialAuthProvider | null;

  // =========================================================================
  // OAUTH OPERATIONS (IOAuthAuthProvider - iOS primarily)
  // =========================================================================
  /**
   * OAuth auth provider for Apple/Google sign-in.
   * Returns null on platforms that don't support OAuth (e.g., web initially).
   *
   * @example
   * ```typescript
   * const result = await getAuthApi().oauth?.signInWithApple(data);
   * if (result?.success) {
   *   router.push('/dashboard');
   * }
   * ```
   */
  oauth: IOAuthAuthProvider | null;

  // =========================================================================
  // CAPABILITY CHECKS
  // =========================================================================
  /**
   * Check if credential authentication (email/password) is available.
   */
  hasCredentialAuth: () => boolean;

  /**
   * Check if OAuth authentication is available.
   */
  hasOAuthAuth: () => boolean;

  /**
   * Get list of available authentication methods on this platform.
   */
  availableAuthMethods: () => AuthMethod[];
}

/**
 * Creates auth API with injected providers.
 *
 * IOC PATTERN: Receives providers via dependency injection.
 * Platform configuration:
 * - Web: authProvider + credentialProvider
 * - iOS: authProvider + oauthProvider
 *
 * @param authProvider - IAuthProvider implementation (required)
 * @param credentialProvider - ICredentialAuthProvider implementation (optional, web only)
 * @param oauthProvider - IOAuthAuthProvider implementation (optional, iOS primarily)
 * @returns Auth API object
 */
export function createAuthApi(
  authProvider: IAuthProvider,
  credentialProvider?: ICredentialAuthProvider | null,
  oauthProvider?: IOAuthAuthProvider | null
): AuthApi {
  return {
    // =========================================================================
    // IDENTITY OPERATIONS (via IAuthProvider)
    // =========================================================================

    /**
     * Get current authenticated user.
     * Returns null if not authenticated.
     */
    getUser: () => authProvider.getUser(),

    /**
     * Get current session.
     * Returns null if no active session.
     */
    getSession: () => authProvider.getSession(),

    /**
     * Logout current user.
     */
    logout: async () => {
      await authProvider.signOut?.();
    },

    /**
     * Update user's metadata (first name, last name).
     * Uses atomic deep-merge to preserve existing metadata.
     */
    updateUserMetadata: async (data: UpdateProfileFormData) => {
      await authProvider.updateUserMetadata({
        firstName: data.firstName,
        lastName: data.lastName,
      });
    },

    // =========================================================================
    // CREDENTIAL OPERATIONS (via ICredentialAuthProvider)
    // =========================================================================

    credential: credentialProvider ?? null,

    // =========================================================================
    // OAUTH OPERATIONS (via IOAuthAuthProvider)
    // =========================================================================

    oauth: oauthProvider ?? null,

    // =========================================================================
    // CAPABILITY CHECKS
    // =========================================================================

    hasCredentialAuth: () => credentialProvider != null,

    hasOAuthAuth: () => oauthProvider != null && oauthProvider.isAvailable(),

    availableAuthMethods: () => {
      const methods: AuthMethod[] = [];
      if (credentialProvider) {
        methods.push('credential');
      }
      if (oauthProvider?.availableProviders.includes('apple')) {
        methods.push('oauth_apple');
      }
      if (oauthProvider?.availableProviders.includes('google')) {
        methods.push('oauth_google');
      }
      return methods;
    },
  };
}

// ============================================================================
// SINGLETON PATTERN (Composition Root)
// ============================================================================

/**
 * Singleton auth API instance.
 * Initialized at composition root (providers/auth-provider.tsx).
 */
let _authApiInstance: AuthApi | null = null;

/**
 * Initialize auth API with providers.
 *
 * Call once at composition root before using authApi.
 *
 * Platform configuration:
 * - Web: initAuthApi(authProvider, credentialProvider)
 * - iOS: initAuthApi(authProvider, null, oauthProvider)
 *
 * @param authProvider - IAuthProvider implementation (required)
 * @param credentialProvider - ICredentialAuthProvider implementation (optional)
 * @param oauthProvider - IOAuthAuthProvider implementation (optional)
 */
export function initAuthApi(
  authProvider: IAuthProvider,
  credentialProvider?: ICredentialAuthProvider | null,
  oauthProvider?: IOAuthAuthProvider | null
): void {
  _authApiInstance = createAuthApi(authProvider, credentialProvider, oauthProvider);
}

/**
 * Get singleton auth API instance.
 *
 * @returns Auth API instance
 * @throws Error if not initialized
 */
export function getAuthApi(): AuthApi {
  if (!_authApiInstance) {
    throw new Error('authApi not initialized - call initAuthApi first');
  }
  return _authApiInstance;
}

/**
 * Check if auth API is initialized.
 */
export function isAuthApiInitialized(): boolean {
  return _authApiInstance !== null;
}

// ============================================================================
// LEGACY EXPORT (Backward Compatibility)
// ============================================================================

/**
 * Legacy auth API export for backward compatibility.
 *
 * Uses getters to lazily access the singleton instance.
 * This allows existing code to continue using `authApi.method()` syntax
 * while the actual implementation routes through the injected providers.
 *
 * MIGRATION PATH:
 * - Replace `authApi.login(data)` with `getAuthApi().credential?.signIn(data)`
 * - Replace `authApi.signUp(data)` with `getAuthApi().credential?.signUp(data)`
 * - Check DataResult.success instead of try/catch
 *
 * @deprecated Use `getAuthApi()` for explicit access with DataResult pattern
 */
export const authApi = {
  // Universal operations (delegated to provider)
  get getUser() {
    return getAuthApi().getUser;
  },
  get getSession() {
    return getAuthApi().getSession;
  },
  get logout() {
    return getAuthApi().logout;
  },
  get updateUserMetadata() {
    return getAuthApi().updateUserMetadata;
  },

  // Credential operations (delegated to ICredentialAuthProvider)
  // These throw for backward compatibility - new code should use DataResult pattern
  get signUp() {
    return async (data: { email: string; password: string; firstName: string; lastName: string }) => {
      const provider = getAuthApi().credential;
      if (!provider) {
        throw new Error('Credential auth not available on this platform');
      }
      const result = await provider.signUp({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
      });
      if (!result.success) {
        throw new Error(result.error.message);
      }
      // Return shape compatible with old Supabase response
      return {
        user: result.data.user,
        session: result.data.session,
      };
    };
  },
  get login() {
    return async (data: { email: string; password: string }) => {
      const provider = getAuthApi().credential;
      if (!provider) {
        throw new Error('Credential auth not available on this platform');
      }
      const result = await provider.signIn(data);
      if (!result.success) {
        throw new Error(result.error.message);
      }
      // Return shape compatible with old Supabase response
      return {
        user: result.data.user,
        session: result.data.session,
      };
    };
  },
  get resetPassword() {
    return async (data: { email: string }) => {
      const provider = getAuthApi().credential;
      if (!provider) {
        throw new Error('Credential auth not available on this platform');
      }
      const result = await provider.resetPassword(data);
      if (!result.success) {
        throw new Error(result.error.message);
      }
    };
  },
  get updatePassword() {
    return async (newPassword: string) => {
      const provider = getAuthApi().credential;
      if (!provider) {
        throw new Error('Credential auth not available on this platform');
      }
      const result = await provider.updatePassword({ newPassword });
      if (!result.success) {
        throw new Error(result.error.message);
      }
    };
  },
  get changePassword() {
    return async (data: { newPassword: string }) => {
      const provider = getAuthApi().credential;
      if (!provider) {
        throw new Error('Credential auth not available on this platform');
      }
      const result = await provider.changePassword(data);
      if (!result.success) {
        throw new Error(result.error.message);
      }
    };
  },
  get changeEmail() {
    return async (data: { newEmail: string }) => {
      const provider = getAuthApi().credential;
      if (!provider) {
        throw new Error('Credential auth not available on this platform');
      }
      const result = await provider.changeEmail(data);
      if (!result.success) {
        throw new Error(result.error.message);
      }
    };
  },

  // Capability checks (new)
  get hasCredentialAuth() {
    return getAuthApi().hasCredentialAuth;
  },
  get hasOAuthAuth() {
    return getAuthApi().hasOAuthAuth;
  },
  get availableAuthMethods() {
    return getAuthApi().availableAuthMethods;
  },

  // Provider access (new)
  get credential() {
    return getAuthApi().credential;
  },
  get oauth() {
    return getAuthApi().oauth;
  },
};
