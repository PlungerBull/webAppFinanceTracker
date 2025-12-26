/**
 * Inbox Types - Domain models for the Transaction Inbox feature
 *
 * The Inbox is a "staging area" for incomplete financial data.
 * Items here have loose constraints and must be "promoted" to the ledger.
 */

/**
 * InboxItem - Domain representation of a transaction_inbox row
 * Represents "dirty" data that needs user review before entering the ledger
 */
export interface InboxItem {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  description: string;
  date: string | null;
  sourceText: string | null;
  accountId: string | null;
  categoryId: string | null;
  exchangeRate: number | null;
  status: 'pending' | 'processed' | 'ignored';
  createdAt: string;
  updatedAt: string;

  // Joined Data (for UI display - populated by API joins)
  account?: {
    id: string;
    name: string;
    currencyCode: string;
    currencySymbol: string;
  };
  category?: {
    id: string;
    name: string;
    color: string;
  };
}

/**
 * PromoteInboxItemParams - Parameters for promoting an inbox item to the ledger
 * All "missing" fields must be provided to satisfy ledger constraints
 */
export interface PromoteInboxItemParams {
  inboxId: string;
  accountId: string;
  categoryId: string;
  finalDescription?: string;
  finalDate?: string;
  finalAmount?: number;
}

/**
 * UpdateInboxItemParams - Parameters for updating a draft inbox item
 * Used to save account/category assignments without promoting to ledger
 * Supports bulk assignment workflows
 */
export interface UpdateInboxItemParams {
  accountId?: string;
  categoryId?: string;
  description?: string;
  amount?: number;
  date?: string;
  exchangeRate?: number;
}

/**
 * CreateInboxItemParams - Parameters for creating a new inbox item
 * Used for quick-add functionality (minimal data required)
 */
export interface CreateInboxItemParams {
  amount: number;
  description: string;
  currency?: string;
  date?: string | null;
  sourceText?: string | null;
}
