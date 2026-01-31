/**
 * Domain Layer - Barrel Export
 *
 * The "Sacred Domain" - feature-agnostic types that any feature can import.
 * This establishes clean boundaries and prevents feature-to-feature coupling.
 *
 * ARCHITECTURE RULES:
 * - Features import from @/domain/ for shared types
 * - Features NEVER import from @/features/other-feature/
 * - Each domain file is organized by bounded context
 *
 * @module domain
 */

// Account Domain
export {
  type AccountType,
  type AccountEntity,
  type AccountViewEntity,
  isAccountViewEntity,
  isDeletedAccount,
} from './accounts';

// Category Domain
export {
  type CategoryType,
  type CategoryEntity,
  type LeafCategoryEntity,
  type GroupingEntity,
  type CategoryWithCountEntity,
  type CreateGroupingDTO,
  type UpdateGroupingDTO,
  type CreateSubcategoryDTO,
  type ReassignSubcategoryDTO,
  // New canonical names
  type CategoryErrorCode,
  type CategoryOperationError,
  type ICategoryOperations,
  isCategoryOperationError,
  // Legacy aliases (deprecated)
  type GroupingErrorCode,
  type GroupingOperationError,
  type IGroupingOperations,
  isGroupingOperationError,
  // Type guards
  isGrouping,
  isSubcategory,
  isLeafCategory,
} from './categories';

// Inbox Domain
export {
  type InboxStatus,
  type InboxItemEntity,
  type InboxItemViewEntity,
  type CreateInboxItemDTO,
  type UpdateInboxItemDTO,
  type PromoteInboxItemDTO,
  type PromoteResult,
  type IInboxOperations,
  isPromotionReady,
} from './inbox';

// Reconciliation Domain
export {
  type ReconciliationStatus,
  type Reconciliation,
  type ReconciliationWithAccount,
  type ReconciliationSummary,
  isDraftReconciliation,
  isCompletedReconciliation,
  isDeletedReconciliation,
} from './reconciliations';

// Auth Domain
export {
  type AuthUserEntity,
  type AuthSessionEntity,
  type AuthEventType,
  type AuthStateChangeCallback,
  type AuthUnsubscribe,
  hasEmail,
  hasFullName,
  getDisplayName,
} from './auth';

// Settings Domain
export {
  type UserSettings,
  type TransactionSortMode,
} from './settings';
