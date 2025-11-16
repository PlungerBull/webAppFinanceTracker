import { z } from 'zod';

// Create transaction schema (matching database schema)
export const createTransactionSchema = z.object({
  description: z
    .string()
    .min(1, 'Description is required')
    .max(200, 'Description must be less than 200 characters')
    .nullable()
    .optional(),
  amount_original: z
    .number()
    .refine((val) => val !== 0, 'Amount cannot be zero'),
  date: z
    .string()
    .min(1, 'Transaction date is required'),
  category_id: z
    .string()
    .uuid('Invalid category')
    .nullable()
    .optional(),
  account_id: z
    .string()
    .uuid('Invalid bank account')
    .min(1, 'Bank account is required'),
  currency_original: z
    .string()
    .length(3, 'Currency must be a valid 3-letter code')
    .regex(/^[A-Z]{3}$/, 'Currency must be uppercase letters'),
  exchange_rate: z
    .number()
    .positive('Exchange rate must be positive')
    .optional()
    .default(1),
  notes: z
    .string()
    .max(500, 'Notes must be less than 500 characters')
    .nullable()
    .optional(),
});

// Update transaction schema
export const updateTransactionSchema = z.object({
  description: z
    .string()
    .min(1, 'Description is required')
    .max(200, 'Description must be less than 200 characters')
    .nullable()
    .optional(),
  amount_original: z
    .number()
    .refine((val) => val !== 0, 'Amount cannot be zero')
    .optional(),
  date: z
    .string()
    .min(1, 'Transaction date is required')
    .optional(),
  category_id: z
    .string()
    .uuid('Invalid category')
    .nullable()
    .optional(),
  account_id: z
    .string()
    .uuid('Invalid bank account')
    .optional(),
  currency_original: z
    .string()
    .length(3, 'Currency must be a valid 3-letter code')
    .regex(/^[A-Z]{3}$/, 'Currency must be uppercase letters')
    .optional(),
  exchange_rate: z
    .number()
    .positive('Exchange rate must be positive')
    .optional(),
  notes: z
    .string()
    .max(500, 'Notes must be less than 500 characters')
    .nullable()
    .optional(),
});

// Export types
export type CreateTransactionFormData = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionFormData = z.infer<typeof updateTransactionSchema>;
