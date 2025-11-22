import { z } from 'zod';
import { VALIDATION, UI, ACCOUNT, ACCOUNTS } from '@/lib/constants';

// Create account schema (simplified - only name, currencies handled separately)
export const createAccountSchema = z.object({
  name: z
    .string()
    .min(VALIDATION.MIN_LENGTH.REQUIRED, ACCOUNTS.MESSAGES.ERROR.VALIDATION_NAME_REQUIRED)
    .max(UI.MAX_LENGTH.ACCOUNT_NAME, ACCOUNTS.MESSAGES.ERROR.VALIDATION_NAME_TOO_LONG),
  color: z.string().regex(ACCOUNT.COLOR_REGEX, ACCOUNTS.MESSAGES.ERROR.VALIDATION_COLOR_INVALID),
});

export const updateAccountSchema = z.object({
  name: z
    .string()
    .min(VALIDATION.MIN_LENGTH.REQUIRED, ACCOUNTS.MESSAGES.ERROR.VALIDATION_NAME_REQUIRED)
    .max(UI.MAX_LENGTH.ACCOUNT_NAME, ACCOUNTS.MESSAGES.ERROR.VALIDATION_NAME_TOO_LONG)
    .optional(),
  color: z
    .string()
    .regex(ACCOUNT.COLOR_REGEX, ACCOUNTS.MESSAGES.ERROR.VALIDATION_COLOR_INVALID)
    .optional(),
});

export type CreateAccountFormData = z.infer<typeof createAccountSchema>;
export type UpdateAccountFormData = z.infer<typeof updateAccountSchema>;
