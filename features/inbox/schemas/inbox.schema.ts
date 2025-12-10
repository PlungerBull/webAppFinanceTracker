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
});

export type PromoteInboxItemFormData = z.infer<typeof promoteInboxItemSchema>;

/**
 * Schema for creating a new inbox item (quick-add)
 */
export const createInboxItemSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'Description is required'),
  currency: z.string().length(3, 'Currency must be a 3-letter code').optional(),
  date: z.string().optional().nullable(),
  sourceText: z.string().optional().nullable(),
});

export type CreateInboxItemFormData = z.infer<typeof createInboxItemSchema>;

/**
 * Schema for dismissing an inbox item
 */
export const dismissInboxItemSchema = z.object({
  inboxId: z.string().uuid('Invalid inbox item ID'),
});

export type DismissInboxItemFormData = z.infer<typeof dismissInboxItemSchema>;
