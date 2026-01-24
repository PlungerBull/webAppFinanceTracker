/**
 * Shared types for the unified transaction detail panel
 * Used by both Inbox and Transactions views
 */

export type PanelMode = 'inbox' | 'transaction';

/**
 * Normalized data structure for the panel
 * Works with both InboxItemViewEntity and TransactionViewEntity
 *
 * CTO MANDATE: All optional fields use null (not undefined) for iOS Swift compatibility.
 * The UI must adapt to the Steel Foundation, not the other way around.
 *
 * NAMING CONVENTION (CTO Mandate):
 * - displayAmount: Decimal dollars for UI display (converted from amountCents)
 * - amountCents: Integer cents for storage/logic (NOT used here - UI boundary)
 */
export interface PanelData {
  id: string;
  description: string | null;
  displayAmount: number | null;  // Decimal dollars for UI display (e.g., 10.50)
  currency: string | null;       // Null when no account selected yet
  accountId: string | null;
  categoryId: string | null;
  date: string | null;
  notes: string | null;
  sourceText: string | null;     // Raw source context (OCR, bank import, etc.)
  exchangeRate: number | null;   // For cross-currency transactions
  reconciliationId: string | null;  // Links to reconciliation session
  cleared: boolean;              // Auto-managed flag (TRUE when linked to reconciliation)
}

/**
 * Editable fields tracked in local state
 *
 * CTO MANDATE: EditedFields use undefined to mean "not edited yet".
 * This is the ONLY place undefined is valid - it signals "user hasn't touched this field".
 * Once edited, the value is either a concrete value or null (to clear).
 *
 * NAMING CONVENTION (CTO Mandate):
 * - displayAmount: Decimal dollars for UI editing
 */
export interface EditedFields {
  description?: string | null;      // undefined = not edited, null = cleared, string = value
  displayAmount?: number | null;    // undefined = not edited, null = cleared, number = value
  accountId?: string | null;
  categoryId?: string | null;
  date?: string | null;
  notes?: string | null;
  exchangeRate?: number | null;
}

/**
 * Account data for selectors
 * CRITICAL: currencyCode is REQUIRED for unambiguous currency display
 * Always display as: ${name} ${currencyCode} (e.g., "BCP Credito PEN")
 */
export interface SelectableAccount {
  id: string;
  name: string;
  currencyCode: string; // REQUIRED - use currencyCode for unambiguous display (avoids $ ambiguity)
  color?: string;
}

/**
 * Category data for selectors
 */
export interface SelectableCategory {
  id: string;
  name: string;
  color: string;
  type: 'income' | 'expense';
}

/**
 * Validation errors for form fields
 */
export interface ValidationErrors {
  description?: string;
  displayAmount?: string;
  accountId?: string;
  categoryId?: string;
  date?: string;
  notes?: string;
}

/**
 * Readiness state for ledger validation
 * Exported from readiness utility, re-exported here for convenience
 */
export type { LedgerReadinessState, ReadinessField } from './utils/readiness';

/**
 * Props for the main TransactionDetailPanel component
 * Supports both legacy single callback (transaction mode) and dual callbacks (inbox mode)
 */
export interface TransactionDetailPanelProps {
  mode: PanelMode;
  data: PanelData;
  accounts: SelectableAccount[];
  categories: SelectableCategory[];

  // Legacy single callback (used by transaction mode)
  onSave?: (updates: EditedFields) => Promise<void>;

  // Inbox dual callbacks (Smart Save pattern)
  onPartialSave?: (updates: EditedFields) => Promise<void>;  // Draft save
  onPromote?: (updates: EditedFields) => Promise<void>;      // Ledger promotion

  onDelete: () => Promise<void>;
  onClose?: () => void;
  isLoading?: boolean;
}
