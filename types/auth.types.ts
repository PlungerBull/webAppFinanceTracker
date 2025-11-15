import type { User } from '@supabase/supabase-js';

import type {
  UpdateProfileFormData,
  ChangePasswordFormData,
  ChangeEmailFormData,
} from '@/features/auth/schemas/profile.schema';

export interface SignUpData {
  firstName: string;
  lastName: string;
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

export type {
  UpdateProfileFormData,
  ChangePasswordFormData,
  ChangeEmailFormData,
};

export interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
}

export interface AuthError {
  message: string;
  code?: string;
}
