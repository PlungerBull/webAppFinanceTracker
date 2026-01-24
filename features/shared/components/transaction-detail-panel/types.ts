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

// 1. Base interface for fields that exist in both worlds
export interface BasePanelData {
  readonly id: string;
  readonly description: string | null;
  readonly displayAmount: number | null;  // Decimal dollars for UI display (e.g., 10.50)
  readonly currency: string | null;       // Null when no account selected yet
  readonly accountId: string | null;
  readonly categoryId: string | null;
  readonly date: string | null;
  readonly notes: string | null;
  readonly exchangeRate: number | null;   // For cross-currency transactions
}

// 2. Specialized interfaces
export interface InboxPanelData extends BasePanelData {
  readonly sourceText: string | null;     // Birth certificate metadata
  readonly reconciliationId: null;        // Inbox items are never reconciled
  readonly cleared: false;               // Inbox items are never cleared
}

export interface TransactionPanelData extends BasePanelData {
  readonly reconciliationId: string | null;
  readonly cleared: boolean;
  readonly sourceText: null;             // Explicitly null for ledger
}

// Union for consumption where mode is checked
export type PanelData = InboxPanelData | TransactionPanelData;

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
 *
 * CTO MANDATE: Discriminated Union Props (The Steel Gatekeeper)
 * Forces mode and data to stay in sync at the type level.
 */

// Common props shared by all modes
interface CommonDetailPanelProps {
  accounts: SelectableAccount[];
  categories: SelectableCategory[];
  onDelete: () => Promise<void>;
  onClose?: () => void;
  isLoading?: boolean;
}

export type TransactionDetailPanelProps =
  | (CommonDetailPanelProps & {
      mode: 'inbox';
      data: InboxPanelData;
      onPartialSave: (updates: EditedFields) => Promise<void>;
      onPromote: (updates: EditedFields) => Promise<void>;
      onSave?: never; // Forbidden in inbox mode
    })
  | (CommonDetailPanelProps & {
      mode: 'transaction';
      data: TransactionPanelData;
      onSave: (updates: EditedFields) => Promise<void>;
      onPartialSave?: never;
      onPromote?: never;
    });
