import { z } from 'zod';
import { VALIDATION, UI, CURRENCY } from '@/lib/constants';

// Create transaction schema (matching database schema)
export const createTransactionSchema = z.object({
  description: z
    .string()
    .min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.DESCRIPTION_REQUIRED)
    .max(UI.MAX_LENGTH.TRANSACTION_DESCRIPTION, VALIDATION.MESSAGES.DESCRIPTION_MAX(UI.MAX_LENGTH.TRANSACTION_DESCRIPTION))
    .nullable()
    .optional(),
  amount_original: z
    .number()
    .refine((val) => val !== 0, VALIDATION.MESSAGES.AMOUNT_ZERO),
  date: z
    .string()
    .min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.TRANSACTION_DATE_REQUIRED),
  category_id: z
    .string()
    .uuid(VALIDATION.MESSAGES.INVALID_CATEGORY)
    .nullable()
    .optional(),
  account_id: z
    .string()
    .uuid(VALIDATION.MESSAGES.INVALID_BANK_ACCOUNT)
    .min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.BANK_ACCOUNT_REQUIRED),
  currency_original: z
    .string()
    .length(CURRENCY.CODE_LENGTH, VALIDATION.MESSAGES.CURRENCY_VALID_CODE)
    .regex(VALIDATION.REGEX.CURRENCY_CODE, VALIDATION.MESSAGES.CURRENCY_UPPERCASE),
  exchange_rate: z
    .number()
    .positive(VALIDATION.MESSAGES.EXCHANGE_RATE_POSITIVE),
  type: z
    .enum(['income', 'expense', 'opening_balance'])
    .nullable()
    .optional(),
  notes: z
    .string()
    .max(UI.MAX_LENGTH.NOTES, VALIDATION.MESSAGES.NOTES_MAX(UI.MAX_LENGTH.NOTES))
    .nullable()
    .optional(),
});

// Update transaction schema
export const updateTransactionSchema = z.object({
  description: z
    .string()
    .min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.DESCRIPTION_REQUIRED)
    .max(UI.MAX_LENGTH.TRANSACTION_DESCRIPTION, VALIDATION.MESSAGES.DESCRIPTION_MAX(UI.MAX_LENGTH.TRANSACTION_DESCRIPTION))
    .nullable()
    .optional(),
  amount_original: z
    .number()
    .refine((val) => val !== 0, VALIDATION.MESSAGES.AMOUNT_ZERO)
    .optional(),
  date: z
    .string()
    .min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.TRANSACTION_DATE_REQUIRED)
    .optional(),
  category_id: z
    .string()
    .uuid(VALIDATION.MESSAGES.INVALID_CATEGORY)
    .nullable()
    .optional(),
  account_id: z
    .string()
    .uuid(VALIDATION.MESSAGES.INVALID_BANK_ACCOUNT)
    .optional(),
  currency_original: z
    .string()
    .length(CURRENCY.CODE_LENGTH, VALIDATION.MESSAGES.CURRENCY_VALID_CODE)
    .regex(VALIDATION.REGEX.CURRENCY_CODE, VALIDATION.MESSAGES.CURRENCY_UPPERCASE)
    .optional(),
  exchange_rate: z
    .number()
    .positive(VALIDATION.MESSAGES.EXCHANGE_RATE_POSITIVE)
    .optional(),
  type: z
    .enum(['income', 'expense', 'opening_balance'])
    .nullable()
    .optional(),
  notes: z
    .string()
    .max(UI.MAX_LENGTH.NOTES, VALIDATION.MESSAGES.NOTES_MAX(UI.MAX_LENGTH.NOTES))
    .nullable()
    .optional(),
});

// Export types
export type CreateTransactionFormData = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionFormData = z.infer<typeof updateTransactionSchema>;
