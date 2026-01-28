/**
 * React Hooks for Currency Formatting
 *
 * These hooks wrap the pure utility functions from lib/utils/currency-formatter.ts
 * with React's useMemo for performance optimization.
 *
 * WHY: Separates React-specific logic (memoization) from pure formatting logic.
 * The pure functions are in lib/utils/currency-formatter.ts for:
 * - Independent testing
 * - Reusability in non-React code
 * - Single source of truth for formatting rules
 */

import { useMemo } from 'react';
import {
  formatCurrency as formatCurrencyPure,
  formatCurrencyShort as formatCurrencyShortPure,
  formatCurrencyCompact as formatCurrencyCompactPure,
} from '@/lib/utils/currency-formatter';

// Re-export pure functions for convenience
export {
  formatCurrency,
  formatCurrencyShort,
  formatCurrencyCompact,
  formatWithSymbol,
  getCurrencySymbol,
  parseCurrency,
  isValidCurrencyFormat,
  formatCurrencyAdvanced,
} from '@/lib/utils/currency-formatter';

// ============================================================================
// REACT HOOKS
// ============================================================================

/**
 * Hook to format a balance with proper currency formatting (2 decimals)
 * Memoized to avoid recalculating on every render
 *
 * @param amount - The numeric amount to format
 * @param currency - Currency code
 * @returns Formatted string with thousands separators and 2 decimals
 *
 * @example
 * const formatted = useFormattedBalance(1234.56, 'USD'); // "1,234.56"
 */
export function useFormattedBalance(amount: number, currency: string) {
  return useMemo(() => formatCurrencyPure(amount, currency), [amount, currency]);
}

/**
 * Hook to format a balance with no decimals (for large numbers)
 * Memoized to avoid recalculating on every render
 *
 * @param amount - The numeric amount to format
 * @param currency - Currency code
 * @returns Formatted string with thousands separators, no decimals
 *
 * @example
 * const formatted = useFormattedBalanceShort(1234.56, 'USD'); // "1,235"
 */
export function useFormattedBalanceShort(amount: number, currency: string) {
  return useMemo(() => formatCurrencyShortPure(amount, currency), [amount, currency]);
}

/**
 * Hook to format a balance in compact notation (for very large numbers)
 * Memoized to avoid recalculating on every render
 *
 * @param amount - The numeric amount to format
 * @param currency - Currency code
 * @returns Formatted string in compact notation
 *
 * @example
 * const formatted = useFormattedBalanceCompact(1234567, 'USD'); // "1.2M"
 */
export function useFormattedBalanceCompact(amount: number, currency: string) {
  return useMemo(() => formatCurrencyCompactPure(amount, currency), [amount, currency]);
}