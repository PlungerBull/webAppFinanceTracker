# 🗃️ Database Documentation

## 📜 Document Governance

**Purpose**: The "Single Source of Truth" for the database state.

**Include**: Current Table schemas, View definitions, and RPC Function signatures.

**Do NOT Include**: Migration history, "Old way vs. New way" comparisons, or frontend-specific logic.

**Maintenance**: This document should always reflect the `current_live_snapshot.sql`. When a migration is applied, the "Migration History" goes to `CHANGELOG.md`, and this doc is updated to the new state.

---

## 🏗️ Architecture Overview

### Currency Model (Flat Architecture)
This database uses a **"Flat" currency architecture**:
- Each `bank_accounts` row has exactly **ONE** `currency_code`
- Multi-currency support for the same account concept is achieved through the `group_id` pattern
- **No junction tables** (`account_currencies` and `currencies` tables were removed)
- Currency cannot be changed after account creation
- **Currency Inheritance:** Transaction currency is **derived** from the selected bank account, not stored separately or editable
  - When creating/editing transactions, users select an account and the currency automatically inherits from that account
  - The transaction detail panel displays currency as read-only text that updates when account selection changes
  - This ensures data consistency: one account = one currency = all transactions in that currency

### Category Model ("Invisible Grouping" Pattern)
This database implements a **two-level category hierarchy** with UI presentation that hides parent categories:
- **Database Structure:** Parent-child hierarchy via `parent_id` foreign key
- **UI Presentation:** Only leaf categories (children + orphaned parents) are selectable
- **Type Inheritance:** Database trigger `sync_category_type_hierarchy` ensures children inherit parent's `type` field automatically
- **Color Inheritance:** Database triggers `cascade_color_to_children` and `sync_child_category_color` ensure children inherit parent's color
- **Transaction Type Derivation:** Database derives transaction type from category relationship; `transactions_view` exposes `category_type` via JOIN (no manual type selection, no frontend state duplication)
- **Validation:** Trigger `check_transaction_category_hierarchy` prevents transactions from being assigned to parent categories

### Opening Balance Pattern
Opening balance transactions are identified by:
- `category_id = NULL`
- `transfer_id = NULL`
- `description = 'Opening Balance'`

Users should set opening balances during account creation.

---

## 📋 Tables

### 📄 Table: `bank_accounts`

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| **id** | uuid | NO | `uuid_generate_v4()` | Primary key |
| **user_id** | uuid | NO | `-` | Foreign key to the user |
| **name** | text | NO | `-` | Account name |
| **created_at** | timestamptz | NO | `now()` | Record creation timestamp |
| **updated_at** | timestamptz | NO | `now()` | Last update timestamp |
| **color** | text | NO | `'#3b82f6'::text` | Hex color code for visual identification (e.g., `#3b82f6`) |
| **is_visible** | bool | NO | `true` | Visibility status |
| **currency_code** | text | NO | `'USD'::text` | Account currency code |
| **group_id** | uuid | NO | `gen_random_uuid()` | Group identifier for linked accounts |
| **type** | account_type | NO | `'checking'::account_type` | Type of account |
| **current_balance** | numeric | NO | `0` | The live ledger balance. Updated automatically via triggers. |

**Constraints:**
- `UNIQUE (user_id, name, currency_code)` - Prevents duplicate accounts
  - Allows same account name in different currencies (e.g., "Savings" in USD and EUR)
  - Prevents duplicate accounts with same user + name + currency

---

### 📄 Table: `categories`

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| **id** | uuid | NO | `uuid_generate_v4()` | Primary key |
| **user_id** | uuid | YES | `-` | Foreign key to the user (can be system if NULL) |
| **name** | text | NO | `-` | Category name |
| **color** | text | NO | `-` | Hex color code for the category |
| **created_at** | timestamptz | NO | `now()` | Record creation timestamp |
| **updated_at** | timestamptz | NO | `now()` | Last update timestamp |
| **parent_id** | uuid | YES | `-` | Foreign key to a parent category (for hierarchy) |
| **type** | transaction_type | NO | `'expense'::transaction_type` | Type of transaction (e.g., expense, income) |

---

### 📄 Table: `global_currencies`

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| **code** | text | NO | `-` | Currency code (e.g., USD) |
| **name** | text | NO | `-` | Currency full name |
| **symbol** | text | NO | `-` | Currency symbol |
| **flag** | text | YES | `-` | Optional flag emoji or code |

---

### 📄 Table: `transactions`

> **Note:** The transaction type is determined implicitly: **transfer** (`transfer_id` NOT NULL), **opening balance** (`category_id` NULL AND `transfer_id` NULL), or **standard** (`category_id` NOT NULL, type derived from category).
>
> The ledger includes `source_text` (raw context like OCR/import data) and `inbox_id` (birth certificate linking to inbox origin) to achieve 1:1 schema parity with the staging area.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| **id** | uuid | NO | `uuid_generate_v4()` | Primary key |
| **user_id** | uuid | NO | `-` | Foreign key to the user |
| **account_id** | uuid | NO | `-` | Account where the transaction occurred |
| **category_id** | uuid | YES | `-` | Transaction category (NULL for transfers/opening balance) |
| **date** | timestamptz | NO | `now()` | Transaction date and time |
| **description** | text | YES | `-` | Brief description of the transaction |
| **amount_original** | numeric | NO | `-` | Amount in the original currency |
| **exchange_rate** | numeric | NO | `1.0` | Exchange rate used to convert to home currency |
| **amount_home** | numeric | NO | `0` | Amount converted to the user's home currency (auto-calculated by trigger) |
| **transfer_id** | uuid | YES | `-` | Link to the paired transaction for transfers (NULL otherwise) |
| **created_at** | timestamptz | NO | `now()` | Record creation timestamp |
| **updated_at** | timestamptz | NO | `now()` | Last update timestamp |
| **notes** | text | YES | `-` | User notes or memo for the transaction (separate from source_text) |
| **source_text** | text | YES | `-` | Raw source context (OCR, bank import data, etc.) - transferred from inbox |
| **inbox_id** | uuid | YES | `-` | Birth certificate - links to original inbox item for audit trail (NULL for manually created transactions) |
| **reconciliation_id** | uuid | YES | `-` | Links to reconciliation session (triggers semi-permeable lock when completed) |
| **cleared** | bool | NO | `false` | Auto-managed flag - TRUE when linked to reconciliation |

**Currency Architecture:**
- Currency is **NOT stored** in the transactions table
- Currency is **ALWAYS derived** from the parent account via JOIN: `bank_accounts.currency_code`
- Query `transactions_view` to access currency (exposed as `currency_original` alias)
- This eliminates redundancy and makes currency desync structurally impossible

---

### 📄 Table: `reconciliations`

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| **id** | uuid | NO | `uuid_generate_v4()` | Primary key |
| **user_id** | uuid | NO | `-` | Foreign key to the user |
| **account_id** | uuid | NO | `-` | Account being reconciled (one reconciliation per account) |
| **name** | text | NO | `-` | Reconciliation session name |
| **beginning_balance** | numeric | NO | `-` | Starting balance from bank statement |
| **ending_balance** | numeric | NO | `-` | Ending balance from bank statement |
| **date_start** | date | YES | `-` | Start date of reconciliation period (NULL for unbounded) |
| **date_end** | date | YES | `-` | End date of reconciliation period (NULL for unbounded) |
| **status** | text | NO | `'draft'` | Session status: 'draft' (editable) or 'completed' (triggers transaction lock) |
| **created_at** | timestamptz | NO | `now()` | Record creation timestamp |
| **updated_at** | timestamptz | NO | `now()` | Last update timestamp |

**Constraints:**
- `reconciliations_valid_date_range CHECK ((date_start IS NULL AND date_end IS NULL) OR (date_start IS NOT NULL AND date_end IS NOT NULL AND date_end >= date_start))` - Date range validation
- `check_reconciliation_date_overlap()` trigger prevents overlapping date ranges for the same account

---

### 📄 Table: `user_settings`

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| **user_id** | uuid | NO | `-` | Primary key / Foreign key to the user |
| **theme** | text | YES | `'system'::text` | User's preferred theme |
| **start_of_week** | int4 | YES | `0` | Day of the week to start (e.g., 0 for Sunday) |
| **created_at** | timestamptz | NO | `now()` | Record creation timestamp |
| **updated_at** | timestamptz | NO | `now()` | Last update timestamp |
| **main_currency** | text | YES | `'USD'::text` | User's main/home currency |

---

### 📄 Table: `transaction_inbox`

> **Staging Area:** This table accepts partial/incomplete data. The "Scratchpad Inbox" allows users to save ANY amount of information (even just an amount or description). Data validation happens at promotion time via the `promote_inbox_item` RPC function.
>
> **Schema Parity:** The inbox table is aligned with the `transactions` table using standardized naming conventions (`amount_original`) and includes `notes` field for user annotations during scratchpad phase.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| **id** | uuid | NO | `uuid_generate_v4()` | Primary key |
| **user_id** | uuid | NO | `-` | Owner |
| **amount_original** | numeric | **YES** | `-` | Nullable draft amount (relaxed constraint for flexible entry) |
| **description** | text | **YES** | `-` | Nullable draft description (relaxed constraint for flexible entry) |
| **date** | timestamptz | YES | `-` | Nullable draft transaction date |
| **status** | text | NO | `'pending'` | Lifecycle: `pending`, `processed`, or `ignored` |
| **account_id** | uuid | YES | `-` | (Optional) Staged Account assignment |
| **category_id** | uuid | YES | `-` | (Optional) Staged Category assignment |
| **exchange_rate** | numeric | YES | `1.0` | (Optional) Staged Exchange Rate - required when account currency differs from main currency |
| **source_text** | text | YES | `-` | Raw context (e.g. "Scanned Receipt", bank import data) |
| **notes** | text | YES | `-` | User annotations during scratchpad phase - transferred to ledger on promotion |
| **created_at** | timestamptz | NO | `now()` | Creation timestamp |
| **updated_at** | timestamptz | NO | `now()` | Last update timestamp |

**Currency Architecture:**
- Currency is **NOT stored** in the transaction_inbox table
- Currency is **ALWAYS derived** from the parent account via LEFT JOIN: `bank_accounts.currency_code`
- When `account_id` is NULL (draft without account), currency is NULL (expected for incomplete drafts)
- Query `transaction_inbox_view` to access currency (exposed as `currency_original` alias)
- This eliminates redundancy and makes currency desync structurally impossible

**Smart Save Integration:**
- **Draft Save:** Can save with ANY subset of fields (amount-only, description-only, notes-only, etc.)
- **Ledger Promotion:** Requires ALL fields (amount, description, account, category, date) + exchange rate if cross-currency
- **Validation:** `promote_inbox_item` RPC performs server-side hard-gate validation before promotion
- **Field Transfer:** Notes and source_text are transferred directly to ledger (Full Mirror architecture)
- **Exchange Rate Logic:** Required when `selectedAccount.currencyCode !== user.main_currency`

---

## 👁️ Views

### 👁️ View: `account_balances`

| Column | Type | Description |
|---|---|---|
| **account_id** | uuid | The ID of the bank account |
| **group_id** | uuid | The group ID of the account |
| **name** | text | Name of the account |
| **currency_code** | text | Currency of the account |
| **type** | account_type | Type of the account |
| **current_balance** | numeric | Calculated current balance of the account |

---

### 👁️ View: `categories_with_counts`

| Column | Type | Description |
|---|---|---|
| **id** | uuid | Category ID |
| **name** | text | Category name |
| **type** | transaction_type | Category type |
| **parent_id** | uuid | Parent category ID |
| **transaction_count** | int8 | Number of transactions assigned to this category |

---

### 👁️ View: `parent_categories_with_counts`

| Column | Type | Description |
|---|---|---|
| **id** | uuid | Parent category ID |
| **name** | text | Parent category name |
| **color** | text | Category color |
| **type** | transaction_type | Category type |
| **user_id** | uuid | User ID associated with the category |
| **created_at** | timestamptz | Creation timestamp |
| **updated_at** | timestamptz | Update timestamp |
| **parent_id** | uuid | Should be NULL for parent categories |
| **transaction_count** | numeric | Total transaction count for the parent and its children |

---

### 👁️ View: `transactions_view`

**Security Configuration**: `security_invoker = true` (enforces RLS policies)
- View executes with the querying user's permissions
- Row-Level Security policies on underlying `transactions` table are fully respected
- Users can only see their own transactions

| Column | Type | Description |
|---|---|---|
| **id** | uuid | Transaction ID |
| **user_id** | uuid | User ID (for RLS/ownership checks) |
| **account_id** | uuid | Account ID (required for editing) |
| **category_id** | uuid | Category ID (required for editing) |
| **description** | text | Transaction description |
| **amount_original** | numeric | Amount in original currency |
| **amount_home** | numeric | Amount in home currency |
| **currency_original** | text | Currency code - aliased from `bank_accounts.currency_code` (NOT stored in transactions table) |
| **account_currency** | text | Currency code - same as currency_original (exposed for clarity) |
| **exchange_rate** | numeric | Exchange rate (required for editing) |
| **date** | timestamptz | Transaction date |
| **notes** | text | User notes or memo (required for editing) |
| **source_text** | text | Raw source context (OCR, bank import data, etc.) |
| **inbox_id** | uuid | Birth certificate - links to original inbox item for audit trail |
| **transfer_id** | uuid | Transfer identifier (if part of a transfer) |
| **created_at** | timestamptz | Creation timestamp |
| **updated_at** | timestamptz | Last update timestamp |
| **account_name** | text | Name of the associated account |
| **account_currency** | text | Currency of the associated account |
| **account_color** | text | Hex color of the associated account (for UI) |
| **category_name** | text | Name of the associated category |
| **category_color** | text | Hex color of the associated category (for UI) |
| **category_type** | transaction_type | Type of the associated category |
| **reconciliation_id** | uuid | Links to reconciliation session |
| **cleared** | bool | Auto-managed flag - TRUE when linked to reconciliation |

**SQL Definition:**
```sql
CREATE VIEW transactions_view AS
SELECT
  -- Core transaction fields
  t.id,
  t.user_id,
  t.account_id,
  t.category_id,
  t.description,
  t.amount_original,
  t.amount_home,
  t.exchange_rate,
  t.date,
  t.notes,
  t.source_text,
  t.inbox_id,
  t.transfer_id,
  t.created_at,
  t.updated_at,

  -- Account fields (currency aliased from account)
  a.name AS account_name,
  a.currency_code AS currency_original,  -- ALIASED for frontend compatibility
  a.currency_code AS account_currency,   -- Also exposed for clarity
  a.color AS account_color,

  -- Category fields
  c.name AS category_name,
  c.color AS category_color,
  c.type AS category_type
FROM transactions t
LEFT JOIN bank_accounts a ON t.account_id = a.id
LEFT JOIN categories c ON t.category_id = c.id;
```

**Note:** `currency_original` is an alias for `account_currency` (both source from `bank_accounts.currency_code`). This aliasing strategy eliminates frontend code changes after normalization.

---

### 👁️ View: `transaction_inbox_view`

**Security Configuration**: `security_invoker = true` (enforces RLS policies)
- View executes with the querying user's permissions
- Row-Level Security policies on underlying `transaction_inbox` table are fully respected
- Users can only see their own inbox items

| Column | Type | Description |
|---|---|---|
| **id** | uuid | Inbox item ID |
| **user_id** | uuid | User ID (for RLS/ownership checks) |
| **amount_original** | numeric | Draft amount (nullable for scratchpad mode) |
| **description** | text | Draft description (nullable for scratchpad mode) |
| **date** | timestamptz | Draft transaction date |
| **source_text** | text | Raw context (OCR, bank import data) |
| **status** | text | Lifecycle status: pending, processed, ignored |
| **account_id** | uuid | Staged account assignment (nullable) |
| **category_id** | uuid | Staged category assignment (nullable) |
| **exchange_rate** | numeric | Staged exchange rate |
| **notes** | text | User annotations during scratchpad phase |
| **created_at** | timestamptz | Creation timestamp |
| **updated_at** | timestamptz | Last update timestamp |
| **account_name** | text | Name of the assigned account (NULL if no account) |
| **currency_original** | text | Currency code - aliased from `bank_accounts.currency_code` (NULL if no account assigned) |
| **account_color** | text | Hex color of the assigned account (NULL if no account) |
| **category_name** | text | Name of the assigned category (NULL if no category) |
| **category_color** | text | Hex color of the assigned category (NULL if no category) |
| **category_type** | transaction_type | Type of the assigned category (NULL if no category) |

**SQL Definition:**
```sql
CREATE VIEW transaction_inbox_view
WITH (security_invoker = true)
AS
SELECT
  -- Core inbox fields
  i.id,
  i.user_id,
  i.amount_original,
  i.description,
  i.date,
  i.source_text,
  i.status,
  i.account_id,
  i.category_id,
  i.exchange_rate,
  i.notes,
  i.created_at,
  i.updated_at,

  -- Account fields (LEFT JOIN to support NULL account_id for drafts)
  a.name AS account_name,
  a.currency_code AS currency_original,  -- ALIASED (NULL if no account)
  a.color AS account_color,

  -- Category fields (LEFT JOIN to support NULL category_id for drafts)
  c.name AS category_name,
  c.color AS category_color,
  c.type AS category_type
FROM transaction_inbox i
LEFT JOIN bank_accounts a ON i.account_id = a.id
LEFT JOIN categories c ON i.category_id = c.id;
```

**Note:** `currency_original` is aliased from `bank_accounts.currency_code` via LEFT JOIN. When `account_id` is NULL (draft without account), `currency_original` is NULL. This is expected behavior for incomplete drafts in scratchpad mode.

---

## ⚡ Functions (PL/pgSQL)

### Core Account & Transaction Functions

| Function Name | Return Type | Arguments | Description |
|---|---|---|---|
| `create_account` | `jsonb` | `p_account_name text`, `p_account_color text`, `p_currency_code text`, `p_starting_balance numeric DEFAULT 0`, `p_account_type account_type DEFAULT 'checking'` | Creates a single account with one currency and optional opening balance. |
| `create_account_group` | `json` | `p_user_id uuid`, `p_name text`, `p_color text`, `p_type account_type`, `p_currencies text[]` | Creates a new account group with separate account rows for each currency (linked by `group_id`) |
| `import_transactions` | `jsonb` | `p_user_id uuid`, `p_transactions jsonb`, `p_default_account_color text`, `p_default_category_color text` | Imports a batch of transactions from JSON array. Auto-creates accounts with `currency_code`. Identifies accounts by **name + currency** (not just name) to support multi-currency accounts with same name. |
| `clear_user_data` | `void` | `p_user_id uuid` | Securely deletes all financial data (Transactions, Inbox, Accounts, Categories) via CASCADE. Preserves User Settings & Auth. Enforces identity verification hard-gate. |
| `replace_account_currency` | `void` | `p_account_id uuid`, `p_old_currency_code varchar`, `p_new_currency_code varchar` | Updates account's currency_code and all associated transactions. |

### Transfer Functions

| Function Name | Return Type | Arguments | Description |
|---|---|---|---|
| `create_transfer` | `json` | `p_user_id uuid`, `p_from_account_id uuid`, `p_to_account_id uuid`, `p_amount numeric`, `p_from_currency text`, `p_to_currency text`, `p_amount_received numeric`, `p_exchange_rate numeric`, `p_date timestamptz`, `p_description text`, `p_category_id uuid` | Creates a paired transfer transaction between two accounts |
| `delete_transfer` | `void` | `p_user_id uuid`, `p_transfer_id uuid` | Deletes a transfer transaction and its paired counterpart |

### Inbox & Promotion Functions

| Function Name | Return Type | Arguments | Description |
|---|---|---|---|
| `promote_inbox_item` | `json` | `p_inbox_id uuid`, `p_account_id uuid`, `p_category_id uuid`, `p_final_description text`, `p_final_date timestamptz`, `p_final_amount numeric`, `p_exchange_rate numeric` | Atomically moves draft from Inbox to Ledger with hard-gate validation. Transfers `notes`, `source_text`, and `exchange_rate` directly from UI state. Exchange rate priority: UI parameter > inbox record > 1.0. Stores `inbox_id` for traceability. |

### Analytics Functions

| Function Name | Return Type | Arguments | Description |
|---|---|---|---|
| `get_monthly_spending_by_category` | `TABLE(...)` | `p_user_id uuid`, `p_months_back integer DEFAULT 6` | Retrieves monthly spending aggregated by category for a user |
| `get_monthly_spending_by_category` | `TABLE(...)` | `p_months_back integer DEFAULT 6`, `p_user_id uuid DEFAULT auth.uid()` | Retrieves monthly spending aggregated by category (alternative signature) |

### Maintenance & Cleanup Functions

| Function Name | Return Type | Arguments | Description |
|---|---|---|---|
| `cleanup_orphaned_categories` | `TABLE(...)` | - | Cleans up categories that were created but have no associated user or transactions |

### Reconciliation Functions

| Function Name | Return Type | Arguments | Description |
|---|---|---|---|
| `link_transactions_to_reconciliation` | `jsonb` | `p_reconciliation_id uuid`, `p_transaction_ids uuid[]` | Atomically links transactions to reconciliation. Validates account match, sets cleared flag. Returns `{ success, linked_count }` |
| `unlink_transactions_from_reconciliation` | `jsonb` | `p_transaction_ids uuid[]` | Atomically unlinks transactions from reconciliation. Returns `{ success, unlinked_count }` |
| `get_reconciliation_summary` | `jsonb` | `p_reconciliation_id uuid` | Returns summary: `{ beginningBalance, endingBalance, linkedSum, linkedCount, difference, isBalanced }` |

### Trigger Functions

| Function Name | Return Type | Description |
|---|---|---|
| `handle_new_user` | `trigger` | Trigger function for new user setup (e.g., initial settings, default accounts/categories) |
| `sync_category_type_hierarchy` | `trigger` | Trigger function to ensure consistency of transaction type in category hierarchy |
| `update_updated_at_column` | `trigger` | Generic trigger function to set `updated_at` column to `now()` on update |
| `calculate_amount_home` | `trigger` | Trigger function to calculate `amount_home` based on `amount_original` and `exchange_rate`. Currency is implicitly determined by account_id (via JOIN to bank_accounts.currency_code). |
| `sync_child_category_color` | `trigger` | Trigger function to cascade color changes from parent to child categories |
| `cascade_color_to_children` | `trigger` | Trigger function to apply parent category color to its direct children |
| `validate_category_hierarchy_func` | `trigger` | Trigger function to enforce rules on category hierarchy (e.g., parents cannot be children, type matching) |
| `check_transaction_category_hierarchy` | `trigger` | Trigger function to prevent transactions from being assigned to parent categories (only leaf nodes) |
| `update_account_balance_ledger` | `trigger` | Automates the `current_balance` updates on the accounts table. Uses `amount_original` (account's native currency) to maintain accurate balances per "One Account = One Currency" architecture. |
| `check_reconciliation_account_match` | `trigger` | Prevents linking transactions to reconciliations from different accounts (Sacred Ledger protection) |
| `check_transaction_reconciliation_lock` | `trigger` | Semi-permeable lock - blocks amount/date/account edits when reconciliation completed, allows category/description/notes |
| `check_reconciliation_date_overlap` | `trigger` | Prevents overlapping reconciliation date ranges for the same account |

---

## 📝 Migration History

For detailed migration history, problem/solution narratives, and architectural evolution, see [CHANGELOG.md](CHANGELOG.md).
