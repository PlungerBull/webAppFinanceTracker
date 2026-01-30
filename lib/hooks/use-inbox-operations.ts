/**
 * Inbox Operations Hook
 *
 * Provides IInboxOperations interface for cross-feature use.
 * Wraps the inbox service implementation without creating direct feature coupling.
 *
 * ARCHITECTURE PATTERN:
 * - Components import from @/lib/hooks/use-inbox-operations
 * - This hook internally uses the inbox service
 * - Features never import from @/features/inbox/services
 *
 * @module lib/hooks/use-inbox-operations
 */

import { useMemo } from 'react';
import { getInboxService } from '@/features/inbox/services/inbox-service';
import type {
  IInboxOperations,
  InboxItemViewEntity,
  PromoteResult,
} from '@/domain/inbox';
import type { DataResult } from '@/lib/data-patterns/types';

/**
 * Hook that provides IInboxOperations interface
 *
 * Creates an adapter around the InboxService that implements IInboxOperations.
 * This allows the transactions feature to use inbox functionality without
 * directly importing from the inbox feature.
 *
 * @returns IInboxOperations implementation
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const inboxOperations = useInboxOperations();
 *
 *   const handleCreate = async () => {
 *     const result = await inboxOperations.create({ description: 'Test' });
 *     if (result.success) {
 *       console.log('Created inbox item:', result.data.id);
 *     }
 *   };
 * }
 * ```
 */
export function useInboxOperations(): IInboxOperations {
  return useMemo(() => {
    const inboxService = getInboxService();

    // Adapter that implements IInboxOperations using InboxService
    // Type assertions needed because InboxService uses its own DataResult type
    // with InboxError, but IInboxOperations expects standard DataResult with Error
    const operations: IInboxOperations = {
      create: (data) =>
        inboxService.create(data) as Promise<DataResult<InboxItemViewEntity>>,
      update: (id, data) =>
        inboxService.update(id, data) as Promise<DataResult<InboxItemViewEntity>>,
      promote: (data) =>
        inboxService.promote(data) as Promise<DataResult<PromoteResult>>,
    };

    return operations;
  }, []);
}
