import { z } from 'zod';
import { VALIDATION, UI } from '@/lib/constants';

// Create account schema (simplified - only name, currencies handled separately)
export const createAccountSchema = z.object({
  name: z
    .string()
    .min(VALIDATION.MIN_LENGTH.REQUIRED, 'Account name is required')
    .max(UI.MAX_LENGTH.ACCOUNT_NAME, 'Account name must be less than 50 characters'),
});

// Update account schema
export const updateAccountSchema = z.object({
  name: z
    .string()
    .min(VALIDATION.MIN_LENGTH.REQUIRED, 'Account name is required')
    .max(UI.MAX_LENGTH.ACCOUNT_NAME, 'Account name must be less than 50 characters')
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format')
    .optional(),
});

// Export types
export type CreateAccountFormData = z.infer<typeof createAccountSchema>;
export type UpdateAccountFormData = z.infer<typeof updateAccountSchema>;
