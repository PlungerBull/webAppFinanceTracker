import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxApi } from '../api/inbox';
import { INBOX } from '@/lib/constants';
import type { PromoteInboxItemParams, CreateInboxItemParams, UpdateInboxItemParams, InboxItem } from '../types';

/**
 * Hook to fetch all pending inbox items with joined account/category data
 * Returns items in FIFO order (oldest first)
 * Includes account and category information for display
 */
export function useInboxItems() {
  return useQuery({
    queryKey: INBOX.QUERY_KEYS.PENDING,
    queryFn: () => inboxApi.getPending(),
    placeholderData: (previousData) => previousData,
  });
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
 * Accepts either PromoteInboxItemParams or InboxItem
 */
export function usePromoteInboxItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: PromoteInboxItemParams | InboxItem) => inboxApi.promote(params),
    onSuccess: () => {
      // Invalidate inbox queries - item should vanish from list
      queryClient.invalidateQueries({ queryKey: INBOX.QUERY_KEYS.ALL });

      // Invalidate transactions queries - new transaction should appear
      queryClient.invalidateQueries({ queryKey: ['transactions'] });

      // Invalidate accounts queries - balance must update
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
