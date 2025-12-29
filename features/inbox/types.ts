/**
 * Inbox Types - Domain models for the Transaction Inbox feature
 *
 * The Inbox is a "staging area" for incomplete financial data.
 * Items here have loose constraints and must be "promoted" to the ledger.
 */

/**
 * InboxItem - Domain representation of a transaction_inbox row
 * Represents "dirty" data that needs user review before entering the ledger
 *
 * SCRATCHPAD MODE: Optional properties use undefined (not null)
 * The data transformer converts database null → undefined for consistency
 */
export interface InboxItem {
  id: string;
  userId: string;
  amountOriginal?: number;      // Optional for scratchpad mode (RENAMED)

  /**
   * Currency code for the inbox item (e.g., "USD", "PEN").
   *
   * **Architecture Note:** This field is NOT stored in the transaction_inbox table.
   * It is derived from the parent account's currency via LEFT JOIN with bank_accounts.
   *
   * Database source: `bank_accounts.currency_code` (via account_id foreign key)
   * View alias: `currency_original` (aliased in transaction_inbox_view)
   *
   * When account_id is NULL (draft without account), this field is NULL.
   *
   * See: Normalized Currency Architecture in AI_CONTEXT.md
   */
  currencyOriginal: string;

  description?: string;         // Optional for scratchpad mode
  date?: string;
  sourceText?: string;
  accountId?: string;
  categoryId?: string;
  exchangeRate?: number;
  notes?: string;               // NEW: User annotations during scratchpad phase
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
  exchangeRate?: number;  // Exchange rate from UI state (Explicit State Commitment)
}

/**
 * UpdateInboxItemParams - Parameters for updating a draft inbox item
 * Used to save account/category assignments without promoting to ledger
 * Supports bulk assignment workflows
 *
 * Note: Uses explicit null unions because updates need to differentiate between
 * "not provided" (undefined) and "clear the value" (null)
 */
export interface UpdateInboxItemParams {
  accountId?: string | null;
  categoryId?: string | null;
  description?: string | null;
  amountOriginal?: number | null;  // RENAMED
  date?: string | null;
  exchangeRate?: number | null;
  notes?: string | null;           // NEW
}

/**
 * CreateInboxItemParams - Parameters for creating a new inbox item
 * NOW SUPPORTS SCRATCHPAD MODE: All fields are optional
 * Allows saving partial data (e.g., just a category, just an amount, etc.)
 * NOTE: currencyOriginal removed - now derived from account_id via transaction_inbox_view
 */
export interface CreateInboxItemParams {
  amountOriginal?: number;       // RENAMED
  description?: string;
  // currencyOriginal: REMOVED - now derived from account_id via transaction_inbox_view
  date?: string;
  sourceText?: string;
  accountId?: string;            // Persist account selection (currency auto-derived from this)
  categoryId?: string;           // Persist category selection
  notes?: string;                // NEW: User annotations
}
