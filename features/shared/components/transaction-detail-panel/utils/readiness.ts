import type { PanelData, EditedFields } from '../types';

/**
 * Readiness state for inbox items
 * Determines whether item can be promoted to ledger
 */
export interface LedgerReadinessState {
  isReady: boolean;              // True if all required fields present
  canSaveDraft: boolean;         // True if at least one field edited
  missingFields: ReadinessField[];
}

export type ReadinessField =
  | 'amount'
  | 'description'
  | 'account'
  | 'category'
  | 'date'
  | 'exchangeRate';

/**
 * Selectable account interface for currency checking
 * Minimum required fields for readiness calculation
 */
interface SelectableAccount {
  id: string;
  currencyCode: string;
}

/**
 * Calculate ledger readiness for inbox items
 *
 * RULES:
 * - Amount: Must be present and non-zero
 * - Description: Must be present and non-empty (trimmed)
 * - Account: Must be selected
 * - Category: Must be selected
 * - Date: Must be present
 * - Exchange Rate: Required ONLY if account currency differs from transaction currency
 *
 * CRITICAL: Uses currencyCode for logic (NOT currencySymbol)
 * - currencySymbol is for UI display ONLY
 * - currencyCode is the source of truth for validation
 *
 * @param data - Current panel data
 * @param editedFields - User edits (takes precedence over data)
 * @param accounts - Available accounts (for currency check)
 * @returns Readiness state with detailed missing fields
 */
export function calculateLedgerReadiness(
  data: PanelData,
  editedFields: EditedFields,
  accounts: SelectableAccount[]
): LedgerReadinessState {
  const missing: ReadinessField[] = [];

  // Merge edited fields with original data (edited takes precedence)
  const finalAmount = editedFields.amount ?? data.amount;
  const finalDescription = editedFields.description ?? data.description;
  const finalAccountId = editedFields.accountId ?? data.accountId;
  const finalCategoryId = editedFields.categoryId ?? data.categoryId;
  const finalDate = editedFields.date ?? data.date;
  const finalExchangeRate = editedFields.exchangeRate;

  // Check each required field
  if (!finalAmount || finalAmount === 0) {
    missing.push('amount');
  }

  if (!finalDescription || finalDescription.trim() === '') {
    missing.push('description');
  }

  if (!finalAccountId) {
    missing.push('account');
  }

  if (!finalCategoryId) {
    missing.push('category');
  }

  if (!finalDate) {
    missing.push('date');
  }

  // Multi-currency check: Exchange rate required if currencies differ
  // CRITICAL: Use currencyCode for validation logic
  const selectedAccount = accounts.find(acc => acc.id === finalAccountId);
  const requiresExchangeRate = selectedAccount && selectedAccount.currencyCode !== data.currency;

  if (requiresExchangeRate && (!finalExchangeRate || finalExchangeRate === 0)) {
    missing.push('exchangeRate');
  }

  // Calculate readiness state
  const isReady = missing.length === 0;
  const canSaveDraft = Object.keys(editedFields).length > 0;

  return {
    isReady,
    canSaveDraft,
    missingFields: missing,
  };
}

/**
 * Get human-readable description of missing fields
 * Used for user-friendly error messages in banners
 *
 * @param state - Ledger readiness state
 * @returns Human-readable message
 */
export function getReadinessMessage(state: LedgerReadinessState): string {
  if (state.isReady) {
    return 'Ready to move to ledger';
  }

  if (state.missingFields.length === 0) {
    return 'No changes made';
  }

  const fieldNames: Record<ReadinessField, string> = {
    amount: 'amount',
    description: 'description',
    account: 'account',
    category: 'category',
    date: 'date',
    exchangeRate: 'exchange rate',
  };

  const missingNames = state.missingFields.map(f => fieldNames[f]);

  if (missingNames.length === 1) {
    return `Missing ${missingNames[0]}`;
  }

  if (missingNames.length === 2) {
    return `Missing ${missingNames[0]} and ${missingNames[1]}`;
  }

  const lastField = missingNames.pop();
  return `Missing ${missingNames.join(', ')}, and ${lastField}`;
}
