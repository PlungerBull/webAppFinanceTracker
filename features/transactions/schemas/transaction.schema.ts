import { z } from 'zod';
import { VALIDATION, UI, CURRENCY } from '@/lib/constants';

// ============================================================================
// DRAFT/FORM SCHEMA - Flexible validation for UI
// ============================================================================
// This schema supports incomplete data for drafts and inbox items.
// Use this for form validation where users might not have all fields ready.
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
    .nullable()
    .optional(), // RELAXED: Optional for inbox routing
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

// ============================================================================
// LEDGER/PAYLOAD SCHEMA - Strict validation for database operations
// ============================================================================
// This schema enforces all database constraints at the type level.
// Use this for API calls that write to the transactions table (ledger).
// Extends the base schema but marks critical fields as REQUIRED.
//
// SACRED LEDGER: currency_original is NOT included here because it's automatically
// derived from account_id by the database trigger. The frontend should never send it.
export const createTransactionLedgerSchema = createTransactionSchema.extend({
  account_id: z
    .string()
    .uuid(VALIDATION.MESSAGES.INVALID_BANK_ACCOUNT), // REQUIRED: Database constraint
  // currency_original REMOVED - Sacred Ledger trigger derives from account_id
  date: z
    .string()
    .min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.TRANSACTION_DATE_REQUIRED), // REQUIRED: Database constraint
}).omit({
  currency_original: true, // Explicitly omit currency_original from ledger operations
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

/**
 * Quick Add Schema - Relaxed validation for inbox items
 * Only amount and description are required
 * Missing account/category → routes to inbox instead of ledger
 */
export const quickAddTransactionSchema = z.object({
  description: z
    .string()
    .min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.DESCRIPTION_REQUIRED)
    .max(UI.MAX_LENGTH.TRANSACTION_DESCRIPTION, VALIDATION.MESSAGES.DESCRIPTION_MAX(UI.MAX_LENGTH.TRANSACTION_DESCRIPTION)),
  amount_original: z
    .number()
    .refine((val) => val !== 0, VALIDATION.MESSAGES.AMOUNT_ZERO),
  date: z
    .string()
    .optional(), // Optional - defaults to today
  category_id: z
    .string()
    .uuid(VALIDATION.MESSAGES.INVALID_CATEGORY)
    .nullable()
    .optional(), // Optional - missing means inbox
  account_id: z
    .string()
    .uuid(VALIDATION.MESSAGES.INVALID_BANK_ACCOUNT)
    .nullable()
    .optional(), // Optional - missing means inbox
  currency_original: z
    .string()
    .length(CURRENCY.CODE_LENGTH, VALIDATION.MESSAGES.CURRENCY_VALID_CODE)
    .regex(VALIDATION.REGEX.CURRENCY_CODE, VALIDATION.MESSAGES.CURRENCY_UPPERCASE)
    .optional(), // Optional - defaults to user's main currency
  notes: z
    .string()
    .max(UI.MAX_LENGTH.NOTES, VALIDATION.MESSAGES.NOTES_MAX(UI.MAX_LENGTH.NOTES))
    .nullable()
    .optional(),
});

// Export types
export type CreateTransactionFormData = z.infer<typeof createTransactionSchema>;
export type CreateTransactionLedgerData = z.infer<typeof createTransactionLedgerSchema>;
export type UpdateTransactionFormData = z.infer<typeof updateTransactionSchema>;
export type QuickAddTransactionFormData = z.infer<typeof quickAddTransactionSchema>;
