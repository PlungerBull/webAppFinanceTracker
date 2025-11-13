import type { User } from '@supabase/supabase-js';

export interface SignUpData {
  email: string;
  password: string;
  confirmPassword: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface ResetPasswordData {
  email: string;
}

export interface UpdatePasswordData {
  password: string;
  confirmPassword: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
}

export interface AuthError {
  message: string;
  code?: string;
}
