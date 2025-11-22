import { useState, useCallback } from 'react';
import { useQueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Generic hook for delete operations with standardized error handling and query invalidation
 * Eliminates duplication in delete dialogs
 *
 * @param deleteApi - API function to delete the item
 * @param queryKeysToInvalidate - Array of query keys to invalidate after successful deletion
 * @param onSuccess - Optional callback to run after successful deletion
 * @returns Delete handler, loading state, and error state
 *
 * @example
 * ```tsx
 * const { handleDelete, isDeleting, error } = useDeleteItem(
 *   deleteAccount,
 *   [QUERY_KEYS.ACCOUNTS, QUERY_KEYS.TRANSACTIONS.ALL],
 *   () => onOpenChange(false)
 * );
 * ```
 */
export function useDeleteItem(
  deleteApi: (id: string) => Promise<void>,
  queryKeysToInvalidate: QueryKey[],
  onSuccess?: () => void
) {
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        setIsDeleting(true);
        setError(null);
        await deleteApi(id);

        // Invalidate all related queries
        await Promise.all(
          queryKeysToInvalidate.map((key) =>
            queryClient.invalidateQueries({ queryKey: key })
          )
        );

        onSuccess?.();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Delete failed';
        setError(errorMessage);
        throw err; // Re-throw to allow caller to handle if needed
      } finally {
        setIsDeleting(false);
      }
    },
    [deleteApi, queryKeysToInvalidate, queryClient, onSuccess]
  );

  return {
    handleDelete,
    isDeleting,
    error,
    setError,
  };
}

/**
 * Return type for useDeleteItem hook
 */
export type UseDeleteItemReturn = {
  handleDelete: (id: string) => Promise<void>;
  isDeleting: boolean;
  error: string | null;
  setError: (error: string | null) => void;
};
