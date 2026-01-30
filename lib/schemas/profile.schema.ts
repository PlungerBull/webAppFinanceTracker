/**
 * Profile Validation Schemas
 *
 * Shared validation schemas for user profile operations.
 * Moved from features/auth to lib for cross-feature use.
 *
 * @module lib/schemas/profile
 */

import { z } from 'zod';
import { VALIDATION } from '@/lib/constants';

/**
 * Schema for updating user profile (First and Last Name)
 */
export const updateProfileSchema = z.object({
  firstName: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.FIRST_NAME_REQUIRED),
  lastName: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.LAST_NAME_REQUIRED),
});

/**
 * Schema for changing password
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.CURRENT_PASSWORD_REQUIRED),
    newPassword: z
      .string()
      .min(VALIDATION.PASSWORD.MIN_LENGTH, VALIDATION.MESSAGES.PASSWORD_MIN_LENGTH)
      .regex(
        VALIDATION.REGEX.PASSWORD,
        VALIDATION.MESSAGES.PASSWORD_REQUIREMENTS
      ),
    confirmPassword: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.CONFIRM_NEW_PASSWORD),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: VALIDATION.MESSAGES.PASSWORDS_DONT_MATCH,
    path: ['confirmPassword'],
  });

/**
 * Schema for changing email
 */
export const changeEmailSchema = z.object({
  newEmail: z.string().email(VALIDATION.MESSAGES.INVALID_EMAIL),
  currentPassword: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.CURRENT_PASSWORD_REQUIRED),
});

// Export types
export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
export type ChangeEmailFormData = z.infer<typeof changeEmailSchema>;
