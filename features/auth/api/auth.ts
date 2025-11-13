import { createClient } from '@/lib/supabase/client';
import type { SignUpData, LoginData, ResetPasswordData } from '@/types/auth.types';

export const authApi = {
  /**
   * Sign up a new user with email and password
   */
  signUp: async (data: SignUpData) => {
    const supabase = createClient();

    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    });

    if (error) {
      console.error('Sign up error:', error);
      throw new Error(error.message || 'Failed to sign up');
    }

    // Create user settings record
    if (authData.user) {
      const { error: settingsError } = await supabase
        .from('user_settings')
        .insert({
          user_id: authData.user.id,
          theme: 'system',
          start_of_week: 0,
        });

      if (settingsError) {
        console.error('Failed to create user settings:', settingsError);
      }
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
      console.error('Get user error:', error);
      throw new Error(error.message || 'Failed to get user');
    }

    return user;
  },
};
