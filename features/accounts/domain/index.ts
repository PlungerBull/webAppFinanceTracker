/**
 * Account Domain Exports
 *
 * Central export point for account domain layer.
 *
 * @module account-domain
 */

// Entities
export type {
  AccountEntity,
  AccountViewEntity,
  AccountType,
} from './entities';
export { isAccountViewEntity, isDeletedAccount } from './entities';

// Types (DTOs & Results)
export type {
  AccountDataResult,
  CreateAccountDTO,
  UpdateAccountDTO,
  CreateAccountGroupResult,
  AccountFilters,
} from './types';

// Errors
export {
  AccountError,
  AccountNotFoundError,
  AccountVersionConflictError,
  AccountValidationError,
  AccountRepositoryError,
  AccountDuplicateNameError,
  isAccountNotFoundError,
  isVersionConflictError,
  isValidationError,
  isDuplicateNameError,
} from './errors';

// Constants
export {
  ACCOUNT_VALIDATION,
  ACCOUNT_ERRORS,
  ACCOUNT_LIMITS,
} from './constants';
