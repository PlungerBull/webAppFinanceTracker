/**
 * Reconciliation Math Utilities
 *
 * Pure calculation functions for reconciliation difference preview.
 * Extracted from bulk-action-bar.tsx for testability and reuse.
 *
 * CTO MANDATE: Integer Cents Only
 * All inputs and outputs are INTEGER CENTS (e.g., $10.50 = 1050)
 * No float arithmetic during accumulation - prevents drift
 *
 * @module lib/utils/reconciliation-math
 */

/**
 * Preview diff calculation result
 *
 * Swift Mirror:
 * ```swift
 * struct ReconciliationPreviewDiff {
 *     let differenceCents: Int
 *     let isBalanced: Bool
 * }
 * ```
 */
export interface ReconciliationPreviewDiff {
  /** The gap that would remain after linking (INTEGER CENTS) */
  differenceCents: number;
  /** TRUE when differenceCents = 0 */
  isBalanced: boolean;
}

/**
 * Calculate the preview reconciliation difference when selected transactions
 * would be linked to a reconciliation.
 *
 * Formula: Difference = Ending Balance - (Beginning Balance + Linked Sum + Selected Sum)
 * Where isBalanced = (Difference === 0)
 *
 * IMPORTANT: All monetary values MUST be in INTEGER CENTS.
 *
 * @param params.beginningBalanceCents - Starting balance per bank statement (INTEGER CENTS)
 * @param params.endingBalanceCents - Ending balance per bank statement (INTEGER CENTS)
 * @param params.currentLinkedSumCents - Sum of already linked transactions (INTEGER CENTS)
 * @param params.selectedAmountsCents - Array of amounts for transactions to be linked (INTEGER CENTS)
 * @returns Preview diff with differenceCents and isBalanced
 *
 * @example
 * ```typescript
 * const result = calculateReconciliationPreviewDiff({
 *   beginningBalanceCents: 100000,  // $1,000.00
 *   endingBalanceCents: 150000,     // $1,500.00
 *   currentLinkedSumCents: 30000,   // $300.00 already linked
 *   selectedAmountsCents: [10000, 5000], // $100 + $50 = $150 to add
 * });
 * // result.differenceCents = 150000 - (100000 + 30000 + 15000) = 5000 ($50.00 remaining)
 * // result.isBalanced = false
 * ```
 */
export function calculateReconciliationPreviewDiff(params: {
  beginningBalanceCents: number;
  endingBalanceCents: number;
  currentLinkedSumCents: number;
  selectedAmountsCents: number[];
}): ReconciliationPreviewDiff {
  const {
    beginningBalanceCents,
    endingBalanceCents,
    currentLinkedSumCents,
    selectedAmountsCents,
  } = params;

  // Sum selected transactions (pure integer math, no float drift)
  const selectedSumCents = selectedAmountsCents.reduce((sum, cents) => sum + cents, 0);

  // Calculate total linked sum after applying selections
  const previewLinkedSumCents = currentLinkedSumCents + selectedSumCents;

  // Calculate the gap: Ending Balance - (Beginning Balance + Total Linked)
  const differenceCents = endingBalanceCents - (beginningBalanceCents + previewLinkedSumCents);

  return {
    differenceCents,
    isBalanced: differenceCents === 0,
  };
}
