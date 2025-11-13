import { z } from 'zod';

// Create account schema
export const createAccountSchema = z.object({
  name: z
    .string()
    .min(1, 'Account name is required')
    .max(50, 'Account name must be less than 50 characters'),
  starting_balance: z
    .number()
    .min(0, 'Starting balance cannot be negative')
    .default(0),
  currency: z
    .string()
    .length(3, 'Currency must be a valid 3-letter code (e.g., USD, EUR)')
    .regex(/^[A-Z]{3}$/, 'Currency must be uppercase letters')
    .default('USD'),
});

// Update account schema
export const updateAccountSchema = z.object({
  name: z
    .string()
    .min(1, 'Account name is required')
    .max(50, 'Account name must be less than 50 characters')
    .optional(),
  starting_balance: z
    .number()
    .min(0, 'Starting balance cannot be negative')
    .optional(),
  currency: z
    .string()
    .length(3, 'Currency must be a valid 3-letter code (e.g., USD, EUR)')
    .regex(/^[A-Z]{3}$/, 'Currency must be uppercase letters')
    .optional(),
});

// Export types
export type CreateAccountFormData = z.infer<typeof createAccountSchema>;
export type UpdateAccountFormData = z.infer<typeof updateAccountSchema>;
