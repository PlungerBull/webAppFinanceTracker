import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxApi } from '../api/inbox';
import { INBOX, PAGINATION } from '@/lib/constants';
import type { PromoteInboxItemParams, CreateInboxItemParams, UpdateInboxItemParams, InboxItem } from '../types';

/**
 * Hook to fetch all pending inbox items with pagination for infinite scroll
 * Returns items in FIFO order (oldest first)
 * Includes account and category information for display
 */
export function useInboxItems() {
  const query = useInfiniteQuery({
    queryKey: INBOX.QUERY_KEYS.PENDING_INFINITE,
    queryFn: ({ pageParam = 0 }) =>
      inboxApi.getPendingPaginated({
        offset: pageParam,
        limit: PAGINATION.DEFAULT_PAGE_SIZE,
      }),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.data.length < PAGINATION.DEFAULT_PAGE_SIZE) {
        return undefined;
      }
      const nextOffset = allPages.reduce((acc, page) => acc + page.data.length, 0);
      return nextOffset;
    },
    initialPageParam: 0,
    placeholderData: (previousData) => previousData,
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
    mutationFn: ({ id, updates }: { id: string; updates: UpdateInboxItemParams }) =>
      inboxApi.updateDraft(id, updates),
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
 * Accepts either PromoteInboxItemParams or InboxItem
 */
export function usePromoteInboxItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: PromoteInboxItemParams | InboxItem) => inboxApi.promote(params),
    onMutate: async (params) => {
      // Extract inbox ID from params
      const inboxId = 'inboxId' in params ? params.inboxId : params.id;

      // Cancel ALL inbox queries to avoid race conditions
      await queryClient.cancelQueries({ queryKey: INBOX.QUERY_KEYS.ALL });

      // Snapshot previous values for rollback (both query types)
      const previousInfinite = queryClient.getQueryData(INBOX.QUERY_KEYS.PENDING_INFINITE);

      // Optimistically update infinite query (all pages)
      queryClient.setQueryData(INBOX.QUERY_KEYS.PENDING_INFINITE, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.filter((item: InboxItem) => item.id !== inboxId),
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
    mutationFn: (inboxId: string) => inboxApi.dismiss(inboxId),
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
    mutationFn: (params: CreateInboxItemParams) => inboxApi.create(params),
    onSuccess: () => {
      // Invalidate inbox queries - new item should appear in pending list
      queryClient.invalidateQueries({ queryKey: INBOX.QUERY_KEYS.ALL });
    },
  });
}
