/**
 * Account Domain Entities
 *
 * Re-exports from @/domain/accounts for backward compatibility.
 * New code should import directly from @/domain/accounts.
 *
 * @module account-entities
 * @deprecated Import from @/domain/accounts instead
 */

// Re-export everything from the Sacred Domain
export {
  type AccountType,
  type AccountEntity,
  type AccountViewEntity,
  isAccountViewEntity,
  isDeletedAccount,
} from '@/domain/accounts';
