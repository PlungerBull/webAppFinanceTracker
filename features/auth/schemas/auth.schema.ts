import { z } from 'zod';
import { VALIDATION } from '@/lib/constants';

// Sign up schema
export const signUpSchema = z
  .object({
    firstName: z
      .string()
      .min(VALIDATION.MIN_LENGTH.REQUIRED, 'First name is required'),
    lastName: z
      .string()
      .min(VALIDATION.MIN_LENGTH.REQUIRED, 'Last name is required'),
    email: z
      .string()
      .min(VALIDATION.MIN_LENGTH.REQUIRED, 'Email is required'),
    password: z
      .string()
      .min(VALIDATION.PASSWORD.MIN_LENGTH, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      ),
    confirmPassword: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

// Login schema
export const loginSchema = z.object({
  email: z
    .string()
    .min(VALIDATION.MIN_LENGTH.REQUIRED, 'Email is required')
    .email('Invalid email address'),
  password: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, 'Password is required'),
});

// Reset password schema
export const resetPasswordSchema = z.object({
  email: z
    .string()
    .min(VALIDATION.MIN_LENGTH.REQUIRED, 'Email is required')
    .email('Invalid email address'),
});

// Update password schema
export const updatePasswordSchema = z
  .object({
    password: z
      .string()
      .min(VALIDATION.PASSWORD.MIN_LENGTH, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      ),
    confirmPassword: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

// Export types
export type SignUpFormData = z.infer<typeof signUpSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type UpdatePasswordFormData = z.infer<typeof updatePasswordSchema>;
