/**
 * Inbox Feature - Barrel Export
 *
 * The Inbox is a "staging area" for incomplete financial data.
 * Items here have loose constraints and must be "promoted" to the ledger.
 */

// Types
export type { InboxItem, PromoteInboxItemParams, CreateInboxItemParams, UpdateInboxItemParams } from './types';

// API
export { inboxApi } from './api/inbox';

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
export { promoteInboxItemSchema, createInboxItemSchema, dismissInboxItemSchema } from './schemas/inbox.schema';
export type { PromoteInboxItemFormData, CreateInboxItemFormData, DismissInboxItemFormData } from './schemas/inbox.schema';
