import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Hook for account navigation and URL parameter management
 * Extracts navigation logic from account-list.tsx
 *
 * @returns Object with navigation handlers and current account ID
 *
 * @example
 * ```tsx
 * const { handleAccountClick, currentAccountId } = useAccountNavigation();
 *
 * <Button onClick={() => handleAccountClick('account-123')}>
 *   Select Account
 * </Button>
 * ```
 */
export function useAccountNavigation() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentAccountId = searchParams.get('account');

  /**
   * Handle account click - toggles account filter in URL
   * Clears category filter when selecting an account (mutually exclusive)
   * Resets pagination
   */
  const handleAccountClick = useCallback(
    (accountId: string) => {
      const params = new URLSearchParams(searchParams.toString());

      // Toggle selection: if already selected, remove filter
      if (currentAccountId === accountId) {
        params.delete('account');
      } else {
        params.set('account', accountId);
        // Clear category filter when selecting an account (mutually exclusive)
        params.delete('categoryId');
      }

      // Reset page if pagination exists
      params.delete('page');

      router.push(`/transactions?${params.toString()}`);
    },
    [router, searchParams, currentAccountId]
  );

  /**
   * Clear account filter
   */
  const clearAccountFilter = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('account');
    router.push(`/transactions?${params.toString()}`);
  }, [router, searchParams]);

  /**
   * Check if a specific account is currently selected
   */
  const isAccountSelected = useCallback(
    (accountId: string) => currentAccountId === accountId,
    [currentAccountId]
  );

  return {
    handleAccountClick,
    clearAccountFilter,
    isAccountSelected,
    currentAccountId,
  };
}

/**
 * Return type for useAccountNavigation hook
 */
export type UseAccountNavigationReturn = {
  handleAccountClick: (accountId: string) => void;
  clearAccountFilter: () => void;
  isAccountSelected: (accountId: string) => boolean;
  currentAccountId: string | null;
};
