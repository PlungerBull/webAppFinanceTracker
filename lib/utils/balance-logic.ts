/**
 * Centralized balance calculation logic for optimistic updates
 *
 * CRITICAL: This MUST MIRROR database trigger logic in current_live_snapshot.sql:1702-1724
 * Any changes to the database trigger MUST be reflected here to prevent UI "jumps"
 *
 * Unit tests ensure TypeScript matches PostgreSQL behavior
 */

export interface BalanceDelta {
  accountId: string;
  deltaCents: number; // Positive = increase, negative = decrease
}

/**
 * Calculate balance deltas when a transaction is updated
 * Handles: amount change, account change, or both
 *
 * @param oldTxn - Original transaction state
 * @param newTxn - Updated transaction state
 * @returns Array of balance deltas (1 item for same account, 2 items for account change)
 */
export function calculateBalanceDeltas(
  oldTxn: { accountId: string; amountOriginal: number },
  newTxn: { accountId: string; amountOriginal: number }
): BalanceDelta[] {
  const toCents = (amount: number) => Math.round(amount * 100);

  const oldAccountId = oldTxn.accountId;
  const newAccountId = newTxn.accountId;
  const oldAmountCents = toCents(oldTxn.amountOriginal);
  const newAmountCents = toCents(newTxn.amountOriginal);

  // Case 1: Same account, amount changed
  if (oldAccountId === newAccountId) {
    return [{
      accountId: oldAccountId,
      deltaCents: newAmountCents - oldAmountCents,
    }];
  }

  // Case 2: Account changed (move transaction between accounts)
  return [
    { accountId: oldAccountId, deltaCents: -oldAmountCents }, // Subtract from old account
    { accountId: newAccountId, deltaCents: newAmountCents },  // Add to new account
  ];
}

/**
 * Calculate balance delta when a transaction is deleted
 *
 * @param txn - Transaction being deleted
 * @returns Balance delta (always negative - subtracts from account)
 */
export function calculateDeleteDelta(
  txn: { accountId: string; amountOriginal: number }
): BalanceDelta {
  const toCents = (amount: number) => Math.round(amount * 100);
  return {
    accountId: txn.accountId,
    deltaCents: -toCents(txn.amountOriginal), // Subtract from account
  };
}

/**
 * Calculate balance delta when a transaction is created
 *
 * @param txn - Transaction being created
 * @returns Balance delta (always positive - adds to account)
 */
export function calculateCreateDelta(
  txn: { accountId: string; amountOriginal: number }
): BalanceDelta {
  const toCents = (amount: number) => Math.round(amount * 100);
  return {
    accountId: txn.accountId,
    deltaCents: toCents(txn.amountOriginal), // Add to account
  };
}

/**
 * Helper: Convert dollars to cents (integer arithmetic for precision)
 * Used to prevent floating-point errors like 0.1 + 0.2 = 0.30000000000000004
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Helper: Convert cents back to dollars
 */
export function fromCents(cents: number): number {
  return cents / 100;
}
