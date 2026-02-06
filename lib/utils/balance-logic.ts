/**
 * Centralized balance calculation logic for optimistic updates
 *
 * CRITICAL: This MUST MIRROR database trigger logic in current_live_snapshot.sql:1702-1724
 * Any changes to the database trigger MUST be reflected here to prevent UI "jumps"
 *
 * CTO MANDATE: Integer Cents Only
 * All inputs are INTEGER CENTS (e.g., $10.50 = 1050)
 * No float arithmetic - prevents drift
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
 * @param oldTxn - Original transaction state (amountCents = INTEGER CENTS)
 * @param newTxn - Updated transaction state (amountCents = INTEGER CENTS)
 * @returns Array of balance deltas (1 item for same account, 2 items for account change)
 */
export function calculateBalanceDeltas(
  oldTxn: { accountId: string; amountCents: number },
  newTxn: { accountId: string; amountCents: number }
): BalanceDelta[] {
  const oldAccountId = oldTxn.accountId;
  const newAccountId = newTxn.accountId;

  // Case 1: Same account, amount changed
  if (oldAccountId === newAccountId) {
    return [{
      accountId: oldAccountId,
      deltaCents: newTxn.amountCents - oldTxn.amountCents,
    }];
  }

  // Case 2: Account changed (move transaction between accounts)
  return [
    { accountId: oldAccountId, deltaCents: -oldTxn.amountCents }, // Subtract from old account
    { accountId: newAccountId, deltaCents: newTxn.amountCents },  // Add to new account
  ];
}

/**
 * Calculate balance delta when a transaction is deleted
 *
 * @param txn - Transaction being deleted (amountCents = INTEGER CENTS)
 * @returns Balance delta (always negative - subtracts from account)
 */
export function calculateDeleteDelta(
  txn: { accountId: string; amountCents: number }
): BalanceDelta {
  return {
    accountId: txn.accountId,
    deltaCents: -txn.amountCents, // Subtract from account
  };
}

/**
 * Calculate balance delta when a transaction is created
 *
 * @param txn - Transaction being created (amountCents = INTEGER CENTS)
 * @returns Balance delta (always positive - adds to account)
 */
export function calculateCreateDelta(
  txn: { accountId: string; amountCents: number }
): BalanceDelta {
  return {
    accountId: txn.accountId,
    deltaCents: txn.amountCents, // Add to account
  };
}

