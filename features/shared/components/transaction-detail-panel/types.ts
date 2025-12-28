/**
 * Shared types for the unified transaction detail panel
 * Used by both Inbox and Transactions views
 */

export type PanelMode = 'inbox' | 'transaction';

/**
 * Normalized data structure for the panel
 * Works with both InboxItem and TransactionRow
 * Uses optional properties (undefined) for consistency with domain types
 */
export interface PanelData {
  id: string;
  description?: string;
  amount?: number;
  currency: string;
  accountId?: string;
  categoryId?: string;
  date?: string;
  notes?: string;
  exchangeRate?: number;  // For cross-currency transactions
}

/**
 * Editable fields tracked in local state
 */
export interface EditedFields {
  description?: string;
  amount?: number;
  accountId?: string;
  categoryId?: string;
  date?: string;
  notes?: string;
  exchangeRate?: number;  // For cross-currency transactions
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
  amount?: string;
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
