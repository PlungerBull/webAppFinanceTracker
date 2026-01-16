/**
 * Accounts Feature Exports
 *
 * Central export point for the accounts feature.
 *
 * @module accounts
 */

// Domain exports
export * from './domain';

// Repository exports
export { createAccountRepository, type IAccountRepository } from './repository';

// Service exports
export { createAccountService, type IAccountService } from './services';

// Hook exports
export { useAccountService } from './hooks/use-account-service';
export { useAccounts, useAccount, useAccountsByGroup } from './hooks/use-accounts';
export {
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
} from './hooks/use-account-mutations';

// Schema exports (existing)
export {
  createAccountSchema,
  updateAccountSchema,
  type CreateAccountFormData,
  type UpdateAccountFormData,
} from './schemas/account.schema';
