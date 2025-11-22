import { z } from 'zod';
import { VALIDATION } from '@/lib/constants';

// Sign up schema
export const signUpSchema = z
  .object({
    firstName: z
      .string()
      .min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.FIRST_NAME_REQUIRED),
    lastName: z
      .string()
      .min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.LAST_NAME_REQUIRED),
    email: z
      .string()
      .min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.EMAIL_REQUIRED),
    password: z
      .string()
      .min(VALIDATION.PASSWORD.MIN_LENGTH, VALIDATION.MESSAGES.PASSWORD_MIN_LENGTH)
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        VALIDATION.MESSAGES.PASSWORD_REQUIREMENTS
      ),
    confirmPassword: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.CONFIRM_PASSWORD),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: VALIDATION.MESSAGES.PASSWORDS_DONT_MATCH,
    path: ['confirmPassword'],
  });

// Login schema
export const loginSchema = z.object({
  email: z
    .string()
    .min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.EMAIL_REQUIRED)
    .email(VALIDATION.MESSAGES.INVALID_EMAIL),
  password: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.PASSWORD_REQUIRED),
});

// Reset password schema
export const resetPasswordSchema = z.object({
  email: z
    .string()
    .min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.EMAIL_REQUIRED)
    .email(VALIDATION.MESSAGES.INVALID_EMAIL),
});

// Update password schema
export const updatePasswordSchema = z
  .object({
    password: z
      .string()
      .min(VALIDATION.PASSWORD.MIN_LENGTH, VALIDATION.MESSAGES.PASSWORD_MIN_LENGTH)
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        VALIDATION.MESSAGES.PASSWORD_REQUIREMENTS
      ),
    confirmPassword: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.CONFIRM_PASSWORD),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: VALIDATION.MESSAGES.PASSWORDS_DONT_MATCH,
    path: ['confirmPassword'],
  });

// Export types
export type SignUpFormData = z.infer<typeof signUpSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type UpdatePasswordFormData = z.infer<typeof updatePasswordSchema>;
