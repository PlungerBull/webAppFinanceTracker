import { z } from 'zod';

/**
 * CTO MANDATE: Strict ISO 8601 format for Swift parity
 * Swift's ISO8601DateFormatter will crash on malformed dates
 * Format: YYYY-MM-DDTHH:mm:ss.SSSZ (with milliseconds and UTC)
 */
const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/**
 * Schema for promoting an inbox item to the ledger
 * Ensures all required fields are valid before calling the API
 *
 * CTO MANDATES:
 * - INTEGER CENTS ONLY (no floating-point amounts)
 * - Strict ISO 8601 dates for Swift compatibility
 */
export const promoteInboxItemSchema = z.object({
  inboxId: z.string().uuid('Invalid inbox item ID'),
  accountId: z.string().uuid('Account is required'),
  categoryId: z.string().uuid('Category is required'),
  finalDescription: z.string().optional(),
  // CTO MANDATE: Strict ISO 8601 for Swift Parity
  finalDate: z.string().regex(isoDateRegex, 'Date must be ISO 8601 format (YYYY-MM-DDTHH:mm:ss.SSSZ)').optional(),
  // CTO MANDATE: Standardize on amountCents (INTEGER ONLY)
  finalAmountCents: z.number().int('Must be integer cents').positive('Amount must be positive').optional(),
  exchangeRate: z.number().positive('Exchange rate must be positive').optional(),
});

export type PromoteInboxItemFormData = z.infer<typeof promoteInboxItemSchema>;

/**
 * Schema for creating a new inbox item (SCRATCHPAD MODE)
 * ALL FIELDS ARE OPTIONAL - supports partial data entry
 * UI layer enforces "at least one field exists" validation
 *
 * CTO MANDATES:
 * - INTEGER CENTS ONLY (no floating-point amounts)
 * - Strict ISO 8601 dates for Swift compatibility
 */
export const createInboxItemSchema = z.object({
  amountCents: z.number().int('Amount must be integer cents').positive('Amount must be positive').nullable().optional(),
  description: z.string().nullable().optional(),
  currencyOriginal: z.string().length(3, 'Currency must be a 3-letter code').optional(),
  // CTO MANDATE: Strict ISO 8601 for Swift Parity
  date: z.string().regex(isoDateRegex, 'Date must be ISO 8601 format (YYYY-MM-DDTHH:mm:ss.SSSZ)').optional().nullable(),
  sourceText: z.string().optional().nullable(),
  accountId: z.string().uuid('Invalid account ID').nullable().optional(),
  categoryId: z.string().uuid('Invalid category ID').nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type CreateInboxItemFormData = z.infer<typeof createInboxItemSchema>;

/**
 * Schema for dismissing an inbox item
 */
export const dismissInboxItemSchema = z.object({
  inboxId: z.string().uuid('Invalid inbox item ID'),
});

export type DismissInboxItemFormData = z.infer<typeof dismissInboxItemSchema>;
