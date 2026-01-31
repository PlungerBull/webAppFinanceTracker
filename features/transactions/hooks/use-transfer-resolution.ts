import { useMemo } from 'react';
import type { GroupedAccount } from '@/lib/hooks/use-grouped-accounts';
import type { AccountViewEntity } from '@/domain/accounts';

/**
 * Input shape for transfer resolution (subset of TransferFormData)
 */
export interface TransferResolutionInput {
  fromGroupId: string | null;
  toGroupId: string | null;
  fromCurrency: string | null;
  toCurrency: string | null;
  fromAccountId: string | null;
  toAccountId: string | null;
}

/**
 * Output shape from transfer resolution hook
 */
export interface TransferResolutionOutput {
  // Currency info for UI
  fromAccountCurrencies: string[];
  toAccountCurrencies: string[];
  isFromAccountMultiCurrency: boolean;
  isToAccountMultiCurrency: boolean;

  // Computed flags
  isSameCurrencyTransfer: boolean;
  isLoopTransfer: boolean;

  // Suggestions: "What should change?" payload
  // Component applies these via single useEffect
  suggestions: Partial<TransferResolutionInput>;

  // Selected groups for UI rendering
  selectedFromGroup: GroupedAccount | undefined;
  selectedToGroup: GroupedAccount | undefined;
}

/**
 * Pure Resolver Hook for Transfer Account/Currency Resolution
 *
 * CTO MANDATE: This hook is SIDE-EFFECT FREE.
 * It calculates "suggestions" that the component orchestrates.
 * This pattern ensures iOS/Swift portability - the logic can be
 * copy-pasted into a Swift ViewModel.
 *
 * @example
 * ```tsx
 * const resolution = useTransferResolution(data, groupedAccounts, rawAccounts);
 *
 * // Component applies suggestions via single visible side-effect
 * useEffect(() => {
 *   if (Object.keys(resolution.suggestions).length > 0) {
 *     onChange(resolution.suggestions);
 *   }
 * }, [resolution.suggestions, onChange]);
 * ```
 */
export function useTransferResolution(
  data: TransferResolutionInput,
  groupedAccounts: GroupedAccount[],
  rawAccounts: AccountViewEntity[]
): TransferResolutionOutput {
  return useMemo(() => {
    const selectedFromGroup = groupedAccounts.find((a) => a.groupId === data.fromGroupId);
    const selectedToGroup = groupedAccounts.find((a) => a.groupId === data.toGroupId);

    // Extract available currencies for each group
    const fromAccountCurrencies = selectedFromGroup?.balances.map((b) => b.currency || 'USD') || [];
    const toAccountCurrencies = selectedToGroup?.balances.map((b) => b.currency || 'USD') || [];

    const isFromAccountMultiCurrency = fromAccountCurrencies.length > 1;
    const isToAccountMultiCurrency = toAccountCurrencies.length > 1;

    // Build suggestions object (only includes fields that need to change)
    const suggestions: Partial<TransferResolutionInput> = {};

    // 1. Auto-select currency if only one available
    if (data.fromGroupId && fromAccountCurrencies.length === 1 && !data.fromCurrency) {
      suggestions.fromCurrency = fromAccountCurrencies[0];
    }
    if (data.toGroupId && toAccountCurrencies.length === 1 && !data.toCurrency) {
      suggestions.toCurrency = toAccountCurrencies[0];
    }

    // 2. Resolve fromAccountId from Group + Currency
    if (data.fromGroupId && data.fromCurrency) {
      const target = rawAccounts.find(
        (acc) => acc.groupId === data.fromGroupId && acc.currencyCode === data.fromCurrency
      );
      if (target && target.id !== data.fromAccountId) {
        // Found matching account, update ID
        suggestions.fromAccountId = target.id;
      } else if (!target && data.fromAccountId !== null) {
        // No matching account (Ghost Account prevention)
        suggestions.fromAccountId = null;
      }
    }

    // 3. Resolve toAccountId from Group + Currency
    if (data.toGroupId && data.toCurrency) {
      const target = rawAccounts.find(
        (acc) => acc.groupId === data.toGroupId && acc.currencyCode === data.toCurrency
      );
      if (target && target.id !== data.toAccountId) {
        // Found matching account, update ID
        suggestions.toAccountId = target.id;
      } else if (!target && data.toAccountId !== null) {
        // No matching account (Ghost Account prevention)
        suggestions.toAccountId = null;
      }
    }

    // Compute transfer flags
    const isSameCurrencyTransfer = data.fromCurrency === data.toCurrency;
    const isLoopTransfer =
      data.fromAccountId !== null &&
      data.toAccountId !== null &&
      data.fromAccountId === data.toAccountId &&
      data.fromCurrency === data.toCurrency;

    return {
      fromAccountCurrencies,
      toAccountCurrencies,
      isFromAccountMultiCurrency,
      isToAccountMultiCurrency,
      isSameCurrencyTransfer,
      isLoopTransfer,
      suggestions,
      selectedFromGroup,
      selectedToGroup,
    };
  }, [
    data.fromGroupId,
    data.toGroupId,
    data.fromCurrency,
    data.toCurrency,
    data.fromAccountId,
    data.toAccountId,
    groupedAccounts,
    rawAccounts,
  ]);
}
