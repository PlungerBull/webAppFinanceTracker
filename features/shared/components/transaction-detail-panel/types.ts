/**
 * Shared types for the unified transaction detail panel
 * Used by both Inbox and Transactions views
 */

export type PanelMode = 'inbox' | 'transaction';

/**
 * Normalized data structure for the panel
 * Works with both InboxItem and TransactionRow
 */
export interface PanelData {
  id: string;
  description: string | null;
  amount: number;
  currency: string;
  accountId: string | null;
  categoryId: string | null;
  date: string | null;
  notes: string | null;
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
}

/**
 * Account data for selectors
 */
export interface SelectableAccount {
  id: string;
  name: string;
  currencyCode: string;
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
 * Props for the main TransactionDetailPanel component
 */
export interface TransactionDetailPanelProps {
  mode: PanelMode;
  data: PanelData;
  accounts: SelectableAccount[];
  categories: SelectableCategory[];
  onSave: (updates: EditedFields) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
}
