/**
 * Auth API
 *
 * Provides authentication operations with IOC injection pattern.
 *
 * ARCHITECTURE:
 * - Universal operations (getUser, getSession, logout, updateUserMetadata) route through IAuthProvider
 * - Credential operations (signUp, login, resetPassword, etc.) remain direct Supabase calls
 *   (platform-specific, not applicable to Apple Sign-In)
 *
 * IOC PATTERN:
 * - Factory `createAuthApi` accepts IAuthProvider as dependency
 * - Singleton initialized at composition root (providers/auth-provider.tsx)
 * - When moving to iOS, inject NativeAppleAuthProvider into the same structure
 *
 * @module auth-api
 */

import { createClient } from '@/lib/supabase/client';
import { AUTH } from '@/lib/constants';
import type { IAuthProvider } from '@/lib/auth/auth-provider.interface';
import type { AuthUserEntity, AuthSessionEntity } from '@/domain/auth';
import type {
  SignUpData,
  LoginData,
  ResetPasswordData,
} from '@/types/auth.types';
import type {
  UpdateProfileFormData,
  ChangeEmailFormData,
  ChangePasswordFormData,
} from '@/features/auth/schemas/profile.schema';

// ============================================================================
// AUTH API FACTORY (IOC Injection)
// ============================================================================

/**
 * Auth API type definition
 */
export interface AuthApi {
  // Universal operations (via IAuthProvider)
  getUser: () => Promise<AuthUserEntity | null>;
  getSession: () => Promise<AuthSessionEntity | null>;
  logout: () => Promise<void>;
  updateUserMetadata: (data: UpdateProfileFormData) => Promise<void>;

  // Credential operations (platform-specific, direct Supabase)
  signUp: (data: SignUpData) => Promise<ReturnType<typeof createCredentialAuthApi>['signUp']>;
  login: (data: LoginData) => Promise<ReturnType<typeof createCredentialAuthApi>['login']>;
  resetPassword: (data: ResetPasswordData) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  changePassword: (data: ChangePasswordFormData) => Promise<void>;
  changeEmail: (data: ChangeEmailFormData) => Promise<void>;
}

/**
 * Creates credential-based auth operations.
 * These are platform-specific (email/password) and remain direct Supabase calls.
 */
function createCredentialAuthApi() {
  return {
    /**
     * Sign up a new user with email and password
     */
    signUp: async (data: SignUpData) => {
      const supabase = createClient();
      const full_name = `${data.firstName} ${data.lastName}`.trim();

      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
          data: {
            firstName: data.firstName,
            lastName: data.lastName,
            full_name: full_name,
          },
        },
      });

      if (error) {
        console.error(AUTH.ERRORS.SIGN_UP_ERROR, error);
        throw new Error(error.message || AUTH.ERRORS.FAILED_SIGN_UP);
      }

      return authData;
    },

    /**
     * Login with email and password
     */
    login: async (data: LoginData) => {
      const supabase = createClient();

      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        console.error(AUTH.ERRORS.LOGIN_ERROR, error);
        throw new Error(error.message || AUTH.ERRORS.FAILED_LOGIN);
      }

      return authData;
    },

    /**
     * Send password reset email
     */
    resetPassword: async (data: ResetPasswordData) => {
      const supabase = createClient();

      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password/update`,
      });

      if (error) {
        console.error(AUTH.ERRORS.RESET_PASSWORD_ERROR, error);
        throw new Error(error.message || AUTH.ERRORS.FAILED_RESET_EMAIL);
      }
    },

    /**
     * Update password (after reset)
     */
    updatePassword: async (newPassword: string) => {
      const supabase = createClient();

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.error(AUTH.ERRORS.UPDATE_PASSWORD_ERROR, error);
        throw new Error(error.message || AUTH.ERRORS.FAILED_UPDATE_PASSWORD);
      }
    },

    /**
     * Change user's password (requires reauthentication)
     */
    changePassword: async (data: ChangePasswordFormData) => {
      const supabase = createClient();

      // 1. Re-authenticate with current password
      const {
        data: { user },
        error: reauthError,
      } = await supabase.auth.reauthenticate();

      if (reauthError || !user) {
        console.error(AUTH.ERRORS.REAUTH_ERROR, reauthError);
        throw new Error(AUTH.ERRORS.REAUTH_FAILED);
      }

      // 2. Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.newPassword,
      });

      if (updateError) {
        console.error(AUTH.ERRORS.CHANGE_PASSWORD_ERROR, updateError);
        throw new Error(updateError.message || AUTH.ERRORS.FAILED_CHANGE_PASSWORD);
      }
    },

    /**
     * Change user's email (requires reauthentication)
     */
    changeEmail: async (data: ChangeEmailFormData) => {
      const supabase = createClient();

      // 1. Re-authenticate
      const {
        data: { user },
        error: reauthError,
      } = await supabase.auth.reauthenticate();

      if (reauthError || !user) {
        console.error(AUTH.ERRORS.REAUTH_ERROR, reauthError);
        throw new Error(AUTH.ERRORS.REAUTH_FAILED);
      }

      // 2. Update to new email
      const { error: updateError } = await supabase.auth.updateUser(
        { email: data.newEmail },
        { emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard` }
      );

      if (updateError) {
        console.error(AUTH.ERRORS.CHANGE_EMAIL_ERROR, updateError);
        throw new Error(updateError.message || AUTH.ERRORS.FAILED_CHANGE_EMAIL);
      }
    },
  };
}

/**
 * Creates auth API with injected auth provider.
 *
 * IOC PATTERN: Receives IAuthProvider via dependency injection.
 * When we move to iOS, we simply inject NativeAppleAuthProvider.
 *
 * @param authProvider - IAuthProvider implementation
 * @returns Auth API object
 */
export function createAuthApi(authProvider: IAuthProvider) {
  const credentialApi = createCredentialAuthApi();

  return {
    // =========================================================================
    // UNIVERSAL OPERATIONS (via IAuthProvider)
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
    // CREDENTIAL OPERATIONS (platform-specific, direct Supabase)
    // =========================================================================

    signUp: credentialApi.signUp,
    login: credentialApi.login,
    resetPassword: credentialApi.resetPassword,
    updatePassword: credentialApi.updatePassword,
    changePassword: credentialApi.changePassword,
    changeEmail: credentialApi.changeEmail,
  };
}

// ============================================================================
// SINGLETON PATTERN (Composition Root)
// ============================================================================

/**
 * Singleton auth API instance.
 * Initialized at composition root (providers/auth-provider.tsx).
 */
let _authApiInstance: ReturnType<typeof createAuthApi> | null = null;

/**
 * Initialize auth API with provider.
 *
 * Call once at composition root before using authApi.
 *
 * @param authProvider - IAuthProvider implementation
 */
export function initAuthApi(authProvider: IAuthProvider): void {
  _authApiInstance = createAuthApi(authProvider);
}

/**
 * Get singleton auth API instance.
 *
 * @returns Auth API instance
 * @throws Error if not initialized
 */
export function getAuthApi(): ReturnType<typeof createAuthApi> {
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
 * while the actual implementation routes through the injected provider.
 *
 * @deprecated Use `getAuthApi()` for explicit access
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

  // Credential operations (direct access - doesn't need provider)
  get signUp() {
    return getAuthApi().signUp;
  },
  get login() {
    return getAuthApi().login;
  },
  get resetPassword() {
    return getAuthApi().resetPassword;
  },
  get updatePassword() {
    return getAuthApi().updatePassword;
  },
  get changePassword() {
    return getAuthApi().changePassword;
  },
  get changeEmail() {
    return getAuthApi().changeEmail;
  },
};
