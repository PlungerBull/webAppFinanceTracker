import { z } from 'zod';

/**
 * Schema for promoting an inbox item to the ledger
 * Ensures all required fields are valid before calling the API
 */
export const promoteInboxItemSchema = z.object({
  inboxId: z.string().uuid('Invalid inbox item ID'),
  accountId: z.string().uuid('Account is required'),
  categoryId: z.string().uuid('Category is required'),
  finalDescription: z.string().optional(),
  finalDate: z.string().optional(),
  finalAmount: z.number().positive('Amount must be positive').optional(),
  exchangeRate: z.number().positive('Exchange rate must be positive').optional(),
});

export type PromoteInboxItemFormData = z.infer<typeof promoteInboxItemSchema>;

/**
 * Schema for creating a new inbox item (SCRATCHPAD MODE)
 * ALL FIELDS ARE OPTIONAL - supports partial data entry
 * UI layer enforces "at least one field exists" validation
 */
export const createInboxItemSchema = z.object({
  amountCents: z.number().int('Amount must be integer cents').positive('Amount must be positive').nullable().optional(),
  description: z.string().nullable().optional(),
  currencyOriginal: z.string().length(3, 'Currency must be a 3-letter code').optional(),
  date: z.string().optional().nullable(),
  sourceText: z.string().optional().nullable(),
  accountId: z.string().uuid('Invalid account ID').nullable().optional(),
  categoryId: z.string().uuid('Invalid category ID').nullable().optional(),
  notes: z.string().nullable().optional(),  // NEW
});

export type CreateInboxItemFormData = z.infer<typeof createInboxItemSchema>;

/**
 * Schema for dismissing an inbox item
 */
export const dismissInboxItemSchema = z.object({
  inboxId: z.string().uuid('Invalid inbox item ID'),
});

export type DismissInboxItemFormData = z.infer<typeof dismissInboxItemSchema>;
