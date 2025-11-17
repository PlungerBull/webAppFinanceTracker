import { z } from 'zod';
import { VALIDATION, UI, CURRENCY } from '@/lib/constants';

// Create transaction schema (matching database schema)
export const createTransactionSchema = z.object({
  description: z
    .string()
    .min(VALIDATION.MIN_LENGTH.REQUIRED, 'Description is required')
    .max(UI.MAX_LENGTH.TRANSACTION_DESCRIPTION, 'Description must be less than 200 characters')
    .nullable()
    .optional(),
  amount_original: z
    .number()
    .refine((val) => val !== 0, 'Amount cannot be zero'),
  date: z
    .string()
    .min(VALIDATION.MIN_LENGTH.REQUIRED, 'Transaction date is required'),
  category_id: z
    .string()
    .uuid('Invalid category')
    .nullable()
    .optional(),
  account_id: z
    .string()
    .uuid('Invalid bank account')
    .min(VALIDATION.MIN_LENGTH.REQUIRED, 'Bank account is required'),
  currency_original: z
    .string()
    .length(CURRENCY.CODE_LENGTH, 'Currency must be a valid 3-letter code')
    .regex(/^[A-Z]{3}$/, 'Currency must be uppercase letters'),
  exchange_rate: z
    .number()
    .positive('Exchange rate must be positive')
    .optional()
    .default(1),
  notes: z
    .string()
    .max(UI.MAX_LENGTH.NOTES, 'Notes must be less than 500 characters')
    .nullable()
    .optional(),
});

// Update transaction schema
export const updateTransactionSchema = z.object({
  description: z
    .string()
    .min(VALIDATION.MIN_LENGTH.REQUIRED, 'Description is required')
    .max(UI.MAX_LENGTH.TRANSACTION_DESCRIPTION, 'Description must be less than 200 characters')
    .nullable()
    .optional(),
  amount_original: z
    .number()
    .refine((val) => val !== 0, 'Amount cannot be zero')
    .optional(),
  date: z
    .string()
    .min(VALIDATION.MIN_LENGTH.REQUIRED, 'Transaction date is required')
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
    .length(CURRENCY.CODE_LENGTH, 'Currency must be a valid 3-letter code')
    .regex(/^[A-Z]{3}$/, 'Currency must be uppercase letters')
    .optional(),
  exchange_rate: z
    .number()
    .positive('Exchange rate must be positive')
    .optional(),
  notes: z
    .string()
    .max(UI.MAX_LENGTH.NOTES, 'Notes must be less than 500 characters')
    .nullable()
    .optional(),
});

// Export types
export type CreateTransactionFormData = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionFormData = z.infer<typeof updateTransactionSchema>;
