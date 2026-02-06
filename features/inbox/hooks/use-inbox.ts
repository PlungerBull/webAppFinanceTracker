/**
 * Inbox React Query Hooks
 *
 * React Query hooks for inbox operations.
 * Uses InboxService (Repository Pattern) with DataResult error handling.
 *
 * @module use-inbox
 */

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getInboxService } from '../services/inbox-service';
import { INBOX, PAGINATION, createQueryOptions } from '@/lib/constants';
import type {
  CreateInboxItemDTO,
  UpdateInboxItemDTO,
  PromoteInboxItemDTO,
} from '../domain/types';
import type { InboxItemViewEntity } from '@/domain/inbox';

/**
 * Get the inbox service instance
 */
const inboxService = getInboxService();

/**
 * Hook to fetch all pending inbox items with pagination for infinite scroll
 * Returns items in FIFO order (oldest first)
 * Includes account and category information for display
 */
export function useInboxItems() {
  const query = useInfiniteQuery({
    queryKey: INBOX.QUERY_KEYS.PENDING_INFINITE,
    queryFn: async ({ pageParam = 0 }) => {
      const result = await inboxService.getPendingPaginated({
        offset: pageParam,
        limit: PAGINATION.DEFAULT_PAGE_SIZE,
      });

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return {
        data: result.data.data,
        count: result.data.total,
      };
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.data.length < PAGINATION.DEFAULT_PAGE_SIZE) {
        return undefined;
      }
      const nextOffset = allPages.reduce((acc, page) => acc + page.data.length, 0);
      return nextOffset;
    },
    initialPageParam: 0,
    placeholderData: (previousData) => previousData,
    ...createQueryOptions('TRANSACTIONAL'),
  });

  // Flatten pages for UI consumption
  const flattenedData = query.data?.pages.flatMap(page => page.data) ?? [];
  const totalCount = query.data?.pages[0]?.count ?? null;

  return {
    ...query,
    data: flattenedData,
    totalCount,
  };
}

/**
 * Hook to update draft inbox item (save account/category without promoting)
 * Supports bulk assignment workflows
 * Item remains in pending status
 */
export function useUpdateInboxDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateInboxItemDTO }) => {
      const result = await inboxService.update(id, updates);

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return result.data;
    },
    onSuccess: () => {
      // Invalidate inbox queries to refresh the list with updated data
      queryClient.invalidateQueries({ queryKey: INBOX.QUERY_KEYS.ALL });
    },
  });
}

/**
 * Hook to promote an inbox item to the ledger
 * CRITICAL CACHE INVALIDATION:
 * - Removes item from inbox list
 * - Updates transactions list to show new transaction
 * - Updates account balance to reflect new spending
 *
 * OPTIMISTIC UPDATES - "Vanishing Effect":
 * - Immediately removes item from inbox UI before server response
 * - Creates buttery smooth user experience
 * - Rolls back on error
 *
 * Accepts either PromoteInboxItemDTO or InboxItemViewEntity
 */
export function usePromoteInboxItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: PromoteInboxItemDTO | InboxItemViewEntity) => {
      // Convert InboxItemViewEntity to PromoteInboxItemDTO if needed
      let dto: PromoteInboxItemDTO = 'inboxId' in params
        ? params as PromoteInboxItemDTO
        : {
            inboxId: params.id,
            accountId: params.accountId ?? '',
            categoryId: params.categoryId ?? '',
            finalDescription: params.description,
            finalDate: params.date,
            finalAmountCents: params.amountCents,
            exchangeRate: params.exchangeRate,
            lastKnownVersion: params.version,
          };

      // S-Tier OCC Guard: Pull-before-promote when version is suspicious
      // A version <= 0 indicates stale local state — fetch the real version from server
      if (dto.lastKnownVersion === undefined || dto.lastKnownVersion <= 0) {
        const freshResult = await inboxService.getById(dto.inboxId);
        if (freshResult.success && freshResult.data.version > 0) {
          dto = { ...dto, lastKnownVersion: freshResult.data.version };
        }
        // If fetch fails, proceed with original — the RPC trigger will enforce correctness
      }

      const result = await inboxService.promote(dto);

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return result.data;
    },
    onMutate: async (params) => {
      // Extract inbox ID from params
      const inboxId = 'inboxId' in params ? params.inboxId : params.id;

      // Cancel ALL inbox queries to avoid race conditions
      await queryClient.cancelQueries({ queryKey: INBOX.QUERY_KEYS.ALL });

      // Snapshot previous values for rollback (both query types)
      const previousInfinite = queryClient.getQueryData(INBOX.QUERY_KEYS.PENDING_INFINITE);

      // Optimistically update infinite query (all pages)
      queryClient.setQueryData(INBOX.QUERY_KEYS.PENDING_INFINITE, (old: InfiniteQueryData | undefined) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            data: page.data.filter((item: InboxItemViewEntity) => item.id !== inboxId),
            count: page.count ? page.count - 1 : null,
          })),
        };
      });

      return { previousInfinite };
    },
    onError: (err, variables, context) => {
      // Rollback on error - restore previous inbox state
      if (context?.previousInfinite) {
        queryClient.setQueryData(INBOX.QUERY_KEYS.PENDING_INFINITE, context.previousInfinite);
      }
    },
    onSuccess: () => {
      // Invalidate queries to ensure data is fresh
      queryClient.invalidateQueries({ queryKey: INBOX.QUERY_KEYS.ALL });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

/**
 * Hook to dismiss (ignore) an inbox item
 * Item is marked as 'ignored' and removed from pending list
 */
export function useDismissInboxItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inboxId: string) => {
      const result = await inboxService.dismiss(inboxId);

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return undefined;
    },
    onSuccess: () => {
      // Invalidate inbox queries - item should vanish from pending list
      queryClient.invalidateQueries({ queryKey: INBOX.QUERY_KEYS.ALL });
    },
  });
}

/**
 * Hook to create a new inbox item (quick-add)
 * For rapid transaction capture without full details
 */
export function useCreateInboxItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateInboxItemDTO) => {
      const result = await inboxService.create(params);

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return result.data;
    },
    onSuccess: () => {
      // Invalidate inbox queries - new item should appear in pending list
      queryClient.invalidateQueries({ queryKey: INBOX.QUERY_KEYS.ALL });
    },
  });
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Type for infinite query data structure
 */
interface InfiniteQueryData {
  pages: Array<{
    data: InboxItemViewEntity[];
    count: number | null;
  }>;
  pageParams: number[];
}
