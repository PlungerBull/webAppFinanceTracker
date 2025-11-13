import { z } from 'zod';

// Create account schema (simplified - only name, currencies handled separately)
export const createAccountSchema = z.object({
  name: z
    .string()
    .min(1, 'Account name is required')
    .max(50, 'Account name must be less than 50 characters'),
});

// Update account schema
export const updateAccountSchema = z.object({
  name: z
    .string()
    .min(1, 'Account name is required')
    .max(50, 'Account name must be less than 50 characters')
    .optional(),
});

// Export types
export type CreateAccountFormData = z.infer<typeof createAccountSchema>;
export type UpdateAccountFormData = z.infer<typeof updateAccountSchema>;
