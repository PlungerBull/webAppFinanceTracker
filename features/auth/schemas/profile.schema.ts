import { z } from 'zod';
import { VALIDATION } from '@/lib/constants';

// For updating First and Last Name
export const updateProfileSchema = z.object({
  firstName: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, 'First name is required'),
  lastName: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, 'Last name is required'),
});

// For changing password
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, 'Current password is required'),
    newPassword: z
      .string()
      .min(VALIDATION.PASSWORD.MIN_LENGTH, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      ),
    confirmPassword: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New passwords don't match",
    path: ['confirmPassword'],
  });

// For changing email
export const changeEmailSchema = z.object({
  newEmail: z.string().email('Invalid email address'),
  currentPassword: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, 'Current password is required'),
});

// Export types
export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
export type ChangeEmailFormData = z.infer<typeof changeEmailSchema>;