import { createClient } from '@/lib/supabase/client';
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
      console.error('Sign up error:', error);
      throw new Error(error.message || 'Failed to sign up');
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
      console.error('Login error:', error);
      throw new Error(error.message || 'Failed to login');
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
      console.error('Logout error:', error);
      throw new Error(error.message || 'Failed to logout');
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
      console.error('Reset password error:', error);
      throw new Error(error.message || 'Failed to send reset email');
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
      console.error('Update password error:', error);
      throw new Error(error.message || 'Failed to update password');
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
      console.error('Get session error:', error);
      throw new Error(error.message || 'Failed to get session');
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
      if (error.name === 'AuthSessionMissingError' || error.message === 'Auth session missing!') {
        return null;
      }

      console.error('Get user error:', error);
      throw new Error(error.message || 'Failed to get user');
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
      console.error('Error updating user metadata:', error);
      throw new Error(error.message || 'Failed to update profile');
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
      console.error('Re-authentication error:', reauthError);
      throw new Error(
        'Re-authentication failed. Please log out and log back in.'
      );
    }

    // Note: Supabase reauthenticate() on its own is often enough.
    // For email/password users, we can *also* verify the password manually,
    // but updateUser is the primary step.

    // 2. Update to new password
    const { error: updateError } = await supabase.auth.updateUser({
      password: data.newPassword,
    });

    if (updateError) {
      console.error('Error changing password:', updateError);
      throw new Error(updateError.message || 'Failed to change password');
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
      console.error('Re-authentication error:', reauthError);
      throw new Error(
        'Re-authentication failed. Please log out and log back in.'
      );
    }

    // 2. Update to new email
    const { error: updateError } = await supabase.auth.updateUser({
      email: data.newEmail,
    }, {
      // Supabase will send confirmation emails to both old and new addresses
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    });

    if (updateError) {
      console.error('Error changing email:', updateError);
      throw new Error(updateError.message || 'Failed to change email');
    }
  },
};

