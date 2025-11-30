import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Hook for grouping navigation and URL parameter management
 * Manages ?grouping={parentId} URL parameter for filtering transactions by parent category
 *
 * @returns Object with navigation handlers and current grouping ID
 *
 * @example
 * ```tsx
 * const { handleGroupingClick, currentGroupingId } = useGroupingNavigation();
 *
 * <Button onClick={() => handleGroupingClick('grouping-123')}>
 *   Select Grouping
 * </Button>
 * ```
 */
export function useGroupingNavigation() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentGroupingId = searchParams.get('grouping');

  /**
   * Handle grouping click - toggles grouping filter in URL
   * Clears account and category filters when selecting a grouping (mutually exclusive)
   * Resets pagination
   */
  const handleGroupingClick = useCallback(
    (groupingId: string) => {
      const params = new URLSearchParams(searchParams.toString());

      // Toggle selection: if already selected, remove filter
      if (currentGroupingId === groupingId) {
        params.delete('grouping');
      } else {
        params.set('grouping', groupingId);
        // Clear account and category filters (mutually exclusive)
        params.delete('account');
        params.delete('categoryId');
      }

      // Reset page if pagination exists
      params.delete('page');

      router.push(`/transactions?${params.toString()}`);
    },
    [router, searchParams, currentGroupingId]
  );

  /**
   * Clear grouping filter
   */
  const clearGroupingFilter = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('grouping');
    router.push(`/transactions?${params.toString()}`);
  }, [router, searchParams]);

  /**
   * Check if a specific grouping is currently selected
   */
  const isGroupingSelected = useCallback(
    (groupingId: string) => currentGroupingId === groupingId,
    [currentGroupingId]
  );

  return {
    handleGroupingClick,
    clearGroupingFilter,
    isGroupingSelected,
    currentGroupingId,
  };
}

/**
 * Return type for useGroupingNavigation hook
 */
export type UseGroupingNavigationReturn = {
  handleGroupingClick: (groupingId: string) => void;
  clearGroupingFilter: () => void;
  isGroupingSelected: (groupingId: string) => boolean;
  currentGroupingId: string | null;
};
