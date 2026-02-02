import { z } from 'zod';

/**
 * Centralized error messages for reconciliation schemas.
 * Keeps UI components clean by defining all validation messages here.
 */
export const RECONCILIATION_ERRORS = {
  ACCOUNT_REQUIRED: 'Account is required',
  ACCOUNT_ID_INVALID: 'Invalid account ID',
  NAME_REQUIRED: 'Name is required',
} as const;

/**
 * Schema for creating or updating a reconciliation.
 * Uses UUID validation for accountId to ensure referential integrity.
 */
export const reconciliationSchema = z.object({
  accountId: z.string().uuid(RECONCILIATION_ERRORS.ACCOUNT_ID_INVALID),
  name: z.string().min(1, RECONCILIATION_ERRORS.NAME_REQUIRED),
  beginningBalance: z.number(),
  endingBalance: z.number(),
  dateStart: z.string().nullable().optional(),
  dateEnd: z.string().nullable().optional(),
});

export type ReconciliationFormData = z.infer<typeof reconciliationSchema>;
