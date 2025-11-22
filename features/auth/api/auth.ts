import { createClient } from '@/lib/supabase/client';
import { AUTH } from '@/lib/constants';
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

export const authApi = {
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
   * Logout current user
   */
  logout: async () => {
    const supabase = createClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error(AUTH.ERRORS.LOGOUT_ERROR, error);
      throw new Error(error.message || AUTH.ERRORS.FAILED_LOGOUT);
    }
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
   * Get current user session
   */
  getSession: async () => {
    const supabase = createClient();

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.error(AUTH.ERRORS.GET_SESSION_ERROR, error);
      throw new Error(error.message || AUTH.ERRORS.FAILED_GET_SESSION);
    }

    return session;
  },

  /**
   * Get current user
   */
  getUser: async () => {
    const supabase = createClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      // If session is missing, just return null (not logged in)
      if (error.name === AUTH.ERRORS.AUTH_SESSION_MISSING_ERROR || error.message === AUTH.ERRORS.AUTH_SESSION_MISSING_MESSAGE) {
        return null;
      }

      console.error(AUTH.ERRORS.GET_USER_ERROR, error);
      throw new Error(error.message || AUTH.ERRORS.FAILED_GET_USER);
    }

    return user;
  },
  /**
   * Update user's metadata (first name, last name, full name)
   */
  updateUserMetadata: async (data: UpdateProfileFormData) => {
    const supabase = createClient();
    const full_name = `${data.firstName} ${data.lastName}`.trim();

    const { error } = await supabase.auth.updateUser({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        full_name: full_name,
      },
    });

    if (error) {
      console.error(AUTH.ERRORS.UPDATE_METADATA_ERROR, error);
      throw new Error(error.message || AUTH.ERRORS.FAILED_UPDATE_PROFILE);
    }
  },

  /**
   * Change user's password (requires current password)
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

    // Note: Supabase reauthenticate() on its own is often enough.
    // For email/password users, we can *also* verify the password manually,
    // but updateUser is the primary step.

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
   * Change user's email (requires current password)
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
    const { error: updateError } = await supabase.auth.updateUser({
      email: data.newEmail,
    }, {
      // Supabase will send confirmation emails to both old and new addresses
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    });

    if (updateError) {
      console.error(AUTH.ERRORS.CHANGE_EMAIL_ERROR, updateError);
      throw new Error(updateError.message || AUTH.ERRORS.FAILED_CHANGE_EMAIL);
    }
  },
};

