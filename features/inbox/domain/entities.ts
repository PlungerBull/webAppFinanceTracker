/**
 * Inbox Domain Entities
 *
 * Re-exports from @/domain/inbox for backward compatibility.
 * New code should import directly from @/domain/inbox.
 *
 * @module inbox-entities
 * @deprecated Import from @/domain/inbox instead
 */

// Re-export everything from the Sacred Domain
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
} from '@/domain/inbox';
