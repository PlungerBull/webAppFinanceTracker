/**
 * Supabase Credential Auth Provider
 *
 * Implements ICredentialAuthProvider for web using Supabase Auth.
 * This is where the 8 direct supabase.auth.* calls are encapsulated.
 *
 * Design:
 * - All methods return DataResult<T, CredentialAuthError> (no throws)
 * - Error mapping centralizes Supabase error → CredentialErrorCode conversion
 * - Uses data-transformers for Supabase → Domain type conversion
 *
 * @module supabase-credential-provider
 */

import type { SupabaseClient, AuthError } from '@supabase/supabase-js';
import type { DataResult } from '@/lib/data-patterns/types';
import type {
  SignUpResult,
  SignInResult,
  CredentialAuthError,
  CredentialErrorCode,
} from '@/domain/auth';
import type {
  ICredentialAuthProvider,
  CredentialSignUpData,
  CredentialSignInData,
  ResetPasswordData,
  UpdatePasswordData,
  ChangePasswordData,
  ChangeEmailData,
} from './credential-auth-provider.interface';
import {
  dbAuthUserToDomain,
  dbAuthSessionToDomain,
} from '@/lib/data/data-transformers';

// ============================================================================
// ERROR MAPPING
// ============================================================================

/**
 * Maps Supabase AuthError to CredentialAuthError
 *
 * Centralizes error code mapping for consistent UI handling.
 */
function mapSupabaseError(error: AuthError): CredentialAuthError {
  const message = error.message;

  // Invalid credentials
  if (
    message.includes('Invalid login credentials') ||
    message.includes('invalid_credentials')
  ) {
    return { code: 'INVALID_CREDENTIALS', message };
  }

  // Email not confirmed
  if (
    message.includes('Email not confirmed') ||
    message.includes('email_not_confirmed')
  ) {
    return { code: 'EMAIL_NOT_CONFIRMED', message };
  }

  // Email already exists
  if (
    message.includes('already registered') ||
    message.includes('User already registered') ||
    message.includes('email_exists')
  ) {
    return { code: 'EMAIL_ALREADY_EXISTS', message };
  }

  // Weak password
  if (
    message.includes('Password') ||
    message.includes('password') ||
    message.includes('weak_password')
  ) {
    return { code: 'WEAK_PASSWORD', message };
  }

  // Rate limited
  if (error.status === 429 || message.includes('rate limit')) {
    return { code: 'RATE_LIMITED', message };
  }

  // Reauthentication failed
  if (
    message.includes('reauthentication') ||
    message.includes('session_not_found')
  ) {
    return { code: 'REAUTHENTICATION_FAILED', message };
  }

  // Network error
  if (message.includes('network') || message.includes('fetch')) {
    return { code: 'NETWORK_ERROR', message };
  }

  // Unknown error
  return { code: 'UNKNOWN_ERROR', message };
}

/**
 * Creates a CredentialAuthError directly (for non-AuthError cases)
 */
function createCredentialError(
  code: CredentialErrorCode,
  message: string
): CredentialAuthError {
  return { code, message };
}

// ============================================================================
// SUPABASE CREDENTIAL PROVIDER CLASS
// ============================================================================

/**
 * Supabase Credential Auth Provider
 *
 * Implements email/password authentication using Supabase Auth.
 */
export class SupabaseCredentialProvider implements ICredentialAuthProvider {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Sign up a new user with email and password.
   */
  async signUp(
    data: CredentialSignUpData
  ): Promise<DataResult<SignUpResult, CredentialAuthError>> {
    const full_name = `${data.firstName} ${data.lastName}`.trim();

    const { data: authData, error } = await this.supabase.auth.signUp({
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
      return {
        success: false,
        data: null,
        error: mapSupabaseError(error),
      };
    }

    // Supabase returns user but no session when email confirmation is required
    const needsEmailConfirmation = !authData.session;

    return {
      success: true,
      data: {
        user: authData.user ? dbAuthUserToDomain(authData.user) : null,
        session: authData.session
          ? dbAuthSessionToDomain(authData.session)
          : null,
        needsEmailConfirmation,
      },
    };
  }

  /**
   * Sign in with email and password.
   */
  async signIn(
    data: CredentialSignInData
  ): Promise<DataResult<SignInResult, CredentialAuthError>> {
    const { data: authData, error } =
      await this.supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

    if (error) {
      return {
        success: false,
        data: null,
        error: mapSupabaseError(error),
      };
    }

    return {
      success: true,
      data: {
        user: dbAuthUserToDomain(authData.user),
        session: dbAuthSessionToDomain(authData.session),
        isNewUser: false,
      },
    };
  }

  /**
   * Send password reset email.
   */
  async resetPassword(
    data: ResetPasswordData
  ): Promise<DataResult<void, CredentialAuthError>> {
    const redirectTo =
      data.redirectTo ??
      `${process.env.NEXT_PUBLIC_APP_URL}/reset-password/update`;

    const { error } = await this.supabase.auth.resetPasswordForEmail(
      data.email,
      { redirectTo }
    );

    if (error) {
      return {
        success: false,
        data: null,
        error: mapSupabaseError(error),
      };
    }

    return {
      success: true,
      data: undefined,
    };
  }

  /**
   * Update password after reset.
   */
  async updatePassword(
    data: UpdatePasswordData
  ): Promise<DataResult<void, CredentialAuthError>> {
    const { error } = await this.supabase.auth.updateUser({
      password: data.newPassword,
    });

    if (error) {
      return {
        success: false,
        data: null,
        error: mapSupabaseError(error),
      };
    }

    return {
      success: true,
      data: undefined,
    };
  }

  /**
   * Change password (requires reauthentication).
   */
  async changePassword(
    data: ChangePasswordData
  ): Promise<DataResult<void, CredentialAuthError>> {
    // Step 1: Reauthenticate
    const { data: reauthData, error: reauthError } =
      await this.supabase.auth.reauthenticate();

    if (reauthError || !reauthData.user) {
      return {
        success: false,
        data: null,
        error: reauthError
          ? mapSupabaseError(reauthError)
          : createCredentialError(
              'REAUTHENTICATION_FAILED',
              'Reauthentication failed'
            ),
      };
    }

    // Step 2: Update to new password
    const { error: updateError } = await this.supabase.auth.updateUser({
      password: data.newPassword,
    });

    if (updateError) {
      return {
        success: false,
        data: null,
        error: mapSupabaseError(updateError),
      };
    }

    return {
      success: true,
      data: undefined,
    };
  }

  /**
   * Change email (requires reauthentication).
   */
  async changeEmail(
    data: ChangeEmailData
  ): Promise<DataResult<void, CredentialAuthError>> {
    // Step 1: Reauthenticate
    const { data: reauthData, error: reauthError } =
      await this.supabase.auth.reauthenticate();

    if (reauthError || !reauthData.user) {
      return {
        success: false,
        data: null,
        error: reauthError
          ? mapSupabaseError(reauthError)
          : createCredentialError(
              'REAUTHENTICATION_FAILED',
              'Reauthentication failed'
            ),
      };
    }

    // Step 2: Update to new email
    const redirectTo =
      data.redirectTo ?? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`;

    const { error: updateError } = await this.supabase.auth.updateUser(
      { email: data.newEmail },
      { emailRedirectTo: redirectTo }
    );

    if (updateError) {
      return {
        success: false,
        data: null,
        error: mapSupabaseError(updateError),
      };
    }

    return {
      success: true,
      data: undefined,
    };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Creates a Supabase credential auth provider.
 *
 * @param supabase - Supabase client instance
 * @returns ICredentialAuthProvider implementation
 */
export function createSupabaseCredentialProvider(
  supabase: SupabaseClient
): ICredentialAuthProvider {
  return new SupabaseCredentialProvider(supabase);
}
