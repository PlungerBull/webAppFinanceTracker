/**
 * Inbox Feature - Barrel Export
 *
 * The Inbox is a "staging area" for incomplete financial data.
 * Items here have loose constraints and must be "promoted" to the ledger.
 *
 * Architecture (CTO Mandate):
 * - Repository Pattern: IInboxRepository → SupabaseInboxRepository
 * - Service Layer: InboxService (handles auth)
 * - React Query Hooks: useInboxItems, usePromoteInboxItem, etc.
 * - DataResult<T> pattern for explicit error handling
 */

// Domain Types
export type {
  DataResult,
  PaginatedResult,
  PaginationOptions,
  CreateInboxItemDTO,
  UpdateInboxItemDTO,
  PromoteInboxItemDTO,
  PromoteResult,
} from './domain/types';

// Domain Entities - InboxItemViewEntity is the canonical type (CTO Mandate: null semantics)
export type { InboxItemEntity, InboxItemViewEntity } from './domain/entities';
export { isPromotionReady } from './domain/entities';

// Domain Errors
export {
  InboxDomainError,
  InboxNotFoundError,
  InboxValidationError,
  InboxRepositoryError,
  InboxPromotionError,
  InboxAlreadyProcessedError,
} from './domain/errors';

// Repository (for testing/DI)
export type { IInboxRepository } from './repository/inbox-repository.interface';
export { SupabaseInboxRepository } from './repository/supabase-inbox-repository';

// Service
export { InboxService, getInboxService } from './services/inbox-service';

// Hooks
export {
  useInboxItems,
  useUpdateInboxDraft,
  usePromoteInboxItem,
  useDismissInboxItem,
  useCreateInboxItem,
} from './hooks/use-inbox';

// Components
export { InboxCard } from './components/inbox-card';
export { InboxList } from './components/inbox-list';

// Schemas
export {
  promoteInboxItemSchema,
  createInboxItemSchema,
  dismissInboxItemSchema,
} from './schemas/inbox.schema';
export type {
  PromoteInboxItemFormData,
  CreateInboxItemFormData,
  DismissInboxItemFormData,
} from './schemas/inbox.schema';
