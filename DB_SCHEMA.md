# 🗃️ Database Documentation
Generated on: **2025-12-25**

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
- **Transaction Type Derivation:** Frontend automatically derives transaction type from selected category (no manual type selection)
- **Validation:** Trigger `check_transaction_category_hierarchy` prevents transactions from being assigned to parent categories

### Opening Balance Pattern
Opening balance transactions are identified by:
- `category_id = NULL`
- `transfer_id = NULL`
- `description = 'Opening Balance'`
- **Note:** As of 2025-12-25 (Invisible Grouping refactor), the "Opening Balance" option has been removed from the Add Transaction Modal UI. Users should set opening balances during account creation.

---

## 📋 Tables

### 📄 Table: `bank_accounts`

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| **id** | uuid | NO | `uuid_generate_v4()` | Primary key |
| **user_id** | uuid | NO | `-` | Foreign key to the user |
| **name** | text | NO | `-` | Account name (clean, without currency suffix - see migration 2025-12-27) |
| **created_at** | timestamptz | NO | `now()` | Record creation timestamp |
| **updated_at** | timestamptz | NO | `now()` | Last update timestamp |
| **color** | text | NO | `'#3b82f6'::text` | Hex color code for visual identification (e.g., `#3b82f6`) |
| **is_visible** | bool | NO | `true` | Visibility status |
| **currency_code** | text | NO | `'USD'::text` | Account currency code |
| **group_id** | uuid | NO | `gen_random_uuid()` | Group identifier for linked accounts |
| **type** | account_type | NO | `'checking'::account_type` | Type of account |
| **current_balance** | numeric | NO | `0` | **[NEW]** The live ledger balance. Updated automatically via triggers. |

**Constraints:**
- `UNIQUE (user_id, name, currency_code)` - Prevents duplicate accounts (added 2025-12-27)
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

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| **id** | uuid | NO | `uuid_generate_v4()` | Primary key |
| **user_id** | uuid | NO | `-` | Foreign key to the user |
| **account_id** | uuid | NO | `-` | Account where the transaction occurred |
| **category_id** | uuid | YES | `-` | Transaction category (NULL for transfers/opening balance) |
| **date** | timestamptz | NO | `now()` | Transaction date and time |
| **description** | text | YES | `-` | Brief description of the transaction |
| **amount_original** | numeric | NO | `-` | Amount in the original currency |
| **currency_original** | text | NO | `-` | Currency of the original amount |
| **exchange_rate** | numeric | NO | `1.0` | Exchange rate used to convert to home currency |
| **amount_home** | numeric | NO | `-` | Amount converted to the user's home currency |
| **transfer_id** | uuid | YES | `-` | Link to the paired transaction for transfers (NULL otherwise) |
| **created_at** | timestamptz | NO | `now()` | Record creation timestamp |
| **updated_at** | timestamptz | NO | `now()` | Last update timestamp |
| **notes** | text | YES | `-` | Optional notes or memo for the transaction |

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

> **Architecture Note:** This is the **Staging Area** for data. Rows here are "dirty" (drafts). They are NOT included in financial reports until promoted to the main `transactions` table.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| **id** | uuid | NO | `uuid_generate_v4()` | Primary key |
| **user_id** | uuid | NO | `-` | Owner |
| **amount** | numeric | NO | `-` | Draft amount |
| **description** | text | NO | `-` | Draft description |
| **status** | text | NO | `'pending'` | Lifecycle: `pending`, `processed`, or `ignored` |
| **account_id** | uuid | YES | `-` | (Optional) Staged Account assignment |
| **category_id** | uuid | YES | `-` | (Optional) Staged Category assignment |
| **exchange_rate** | numeric | YES | `1.0` | (Optional) Staged Exchange Rate |
| **source_text** | text | YES | `-` | Context (e.g. "Scanned Receipt") |
| **created_at** | timestamptz | NO | `now()` | Creation timestamp |
| **updated_at** | timestamptz | NO | `now()` | Last update timestamp |

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

**Updated:** 2025-12-26 - Expanded to include IDs and colors for editing support

| Column | Type | Description |
|---|---|---|
| **id** | uuid | Transaction ID |
| **user_id** | uuid | User ID (for RLS/ownership checks) |
| **account_id** | uuid | Account ID (required for editing) |
| **category_id** | uuid | Category ID (required for editing) |
| **description** | text | Transaction description |
| **amount_original** | numeric | Amount in original currency |
| **amount_home** | numeric | Amount in home currency |
| **currency_original** | text | Original currency code |
| **exchange_rate** | numeric | Exchange rate (required for editing) |
| **date** | timestamptz | Transaction date |
| **notes** | text | Transaction notes (required for editing) |
| **transfer_id** | uuid | Transfer identifier (if part of a transfer) |
| **created_at** | timestamptz | Creation timestamp |
| **updated_at** | timestamptz | Last update timestamp |
| **account_name** | text | Name of the associated account |
| **account_currency** | text | Currency of the associated account |
| **account_color** | text | Hex color of the associated account (for UI) |
| **category_name** | text | Name of the associated category |
| **category_color** | text | Hex color of the associated category (for UI) |
| **category_type** | transaction_type | Type of the associated category |

**SQL Definition:**
```sql
CREATE VIEW transactions_view AS
SELECT
  t.id,
  t.user_id,
  t.account_id,
  t.category_id,
  t.description,
  t.amount_original,
  t.amount_home,
  t.currency_original,
  t.exchange_rate,
  t.date,
  t.notes,
  t.transfer_id,
  t.created_at,
  t.updated_at,
  a.name AS account_name,
  a.currency_code AS account_currency,
  a.color AS account_color,
  c.name AS category_name,
  c.color AS category_color,
  c.type AS category_type
FROM transactions t
LEFT JOIN bank_accounts a ON t.account_id = a.id
LEFT JOIN categories c ON t.category_id = c.id;
```

---

## ⚡ Functions (PL/pgSQL)

### Core Account & Transaction Functions

| Function Name | Return Type | Arguments | Description |
|---|---|---|---|
| `create_account` | `jsonb` | `p_account_name text`, `p_account_color text`, `p_currency_code text`, `p_starting_balance numeric DEFAULT 0`, `p_account_type account_type DEFAULT 'checking'` | **[UPDATED 2025-12-25]** Creates a single account with one currency and optional opening balance. Simplified from old multi-currency version. |
| `create_account_group` | `json` | `p_user_id uuid`, `p_name text`, `p_color text`, `p_type account_type`, `p_currencies text[]` | Creates a new account group with separate account rows for each currency (linked by `group_id`) |
| `import_transactions` | `jsonb` | `p_user_id uuid`, `p_transactions jsonb`, `p_default_account_color text`, `p_default_category_color text` | **[FIXED 2025-12-27]** Imports a batch of transactions from JSON array. Auto-creates accounts with `currency_code`. **CRITICAL:** Now identifies accounts by **name + currency** (not just name) to support multi-currency accounts with same name. |
| `clear_user_data` | `void` | `p_user_id uuid` | **[FIXED 2025-12-25]** Deletes all transactional and account data for a given user. Cleaned up to remove references to deleted tables. |
| `replace_account_currency` | `void` | `p_account_id uuid`, `p_old_currency_code varchar`, `p_new_currency_code varchar` | **[FIXED 2025-12-25]** Updates account's currency_code and all associated transactions. Signature changed - removed `p_new_starting_balance` parameter. |

### Transfer Functions

| Function Name | Return Type | Arguments | Description |
|---|---|---|---|
| `create_transfer` | `json` | `p_user_id uuid`, `p_from_account_id uuid`, `p_to_account_id uuid`, `p_amount numeric`, `p_from_currency text`, `p_to_currency text`, `p_amount_received numeric`, `p_exchange_rate numeric`, `p_date timestamptz`, `p_description text`, `p_category_id uuid` | Creates a paired transfer transaction between two accounts |
| `delete_transfer` | `void` | `p_user_id uuid`, `p_transfer_id uuid` | Deletes a transfer transaction and its paired counterpart |

### Inbox & Promotion Functions

| Function Name | Return Type | Arguments | Description |
|---|---|---|---|
| `promote_inbox_item` | `json` | `p_inbox_id uuid`, `p_account_id uuid`, `p_category_id uuid`, ... | **[ARCHITECTURAL]** Atomically moves a draft from Inbox to Main Ledger. Validates data before insertion. |

### Analytics Functions

| Function Name | Return Type | Arguments | Description |
|---|---|---|---|
| `get_monthly_spending_by_category` | `TABLE(...)` | `p_user_id uuid`, `p_months_back integer DEFAULT 6` | Retrieves monthly spending aggregated by category for a user |
| `get_monthly_spending_by_category` | `TABLE(...)` | `p_months_back integer DEFAULT 6`, `p_user_id uuid DEFAULT auth.uid()` | Retrieves monthly spending aggregated by category (alternative signature) |

### Maintenance & Cleanup Functions

| Function Name | Return Type | Arguments | Description |
|---|---|---|---|
| `cleanup_orphaned_categories` | `TABLE(...)` | - | Cleans up categories that were created but have no associated user or transactions |

### Trigger Functions

| Function Name | Return Type | Description |
|---|---|---|
| `handle_new_user` | `trigger` | Trigger function for new user setup (e.g., initial settings, default accounts/categories) |
| `sync_category_type_hierarchy` | `trigger` | Trigger function to ensure consistency of transaction type in category hierarchy |
| `update_updated_at_column` | `trigger` | Generic trigger function to set `updated_at` column to `now()` on update |
| `calculate_amount_home` | `trigger` | Trigger function to calculate `amount_home` based on `amount_original` and `exchange_rate` |
| `sync_child_category_color` | `trigger` | Trigger function to cascade color changes from parent to child categories |
| `cascade_color_to_children` | `trigger` | Trigger function to apply parent category color to its direct children |
| `validate_category_hierarchy_func` | `trigger` | Trigger function to enforce rules on category hierarchy (e.g., parents cannot be children, type matching) |
| `check_transaction_category_hierarchy` | `trigger` | Trigger function to prevent transactions from being assigned to parent categories (only leaf nodes) |
| `update_account_balance_ledger` | `trigger` | **[PERFORMANCE]** Automates the `current_balance` updates on the accounts table |

---

## 📝 Migration History

### 2025-12-25: Unified Transaction Detail Panel Redesign (Frontend Only)
- **Architecture Change**: Implemented unified "reconciliation and editing engine" for both Inbox and Transactions views
- **UI/UX Overhaul**: Complete redesign of right detail panel with premium professional styling
- **Key Features**:
  - **Unified Component**: Single shared panel component for both Inbox (mode='inbox') and Transactions (mode='transaction')
  - **Editable Fields**: Payee/description and amount now editable in both views (previously read-only)
  - **Batch Save Pattern**: All edits staged locally, saved only on explicit "Keep Changes" / "Promote to Ledger" button click
  - **Dynamic Styling**: Amount color changes based on context (gray for inbox, green for income, red for expense)
  - **Missing Info Warning**: Orange banner and field styling in Inbox mode when required fields (account/category) are unassigned
  - **Unsaved Changes Protection**: Confirmation dialog when closing panel with pending edits
- **Design System**:
  - **Panel Width**: Fixed 400px width
  - **Typography**: `text-xl` payee (borderless input), `text-3xl` monospaced amount, `text-[10px]` labels
  - **Spacing**: `space-y-8` (32px) between form sections
  - **Action Buttons**: Blue "Promote to Ledger" (Inbox), Slate "Keep Changes" (Transactions)
- **Database**: No schema changes - fully backward compatible
- **Files Created**:
  - `features/shared/components/transaction-detail-panel/index.tsx` (main panel)
  - `features/shared/components/transaction-detail-panel/types.ts` (shared types)
  - `features/shared/components/transaction-detail-panel/identity-header.tsx` (editable header)
  - `features/shared/components/transaction-detail-panel/form-section.tsx` (form fields)
  - `features/shared/components/transaction-detail-panel/missing-info-banner.tsx` (inbox warning)
  - `features/shared/components/transaction-detail-panel/action-footer.tsx` (mode-specific buttons)
  - `features/inbox/components/inbox-detail-panel.tsx` (inbox wrapper)
  - `features/inbox/components/inbox-table.tsx` (new three-column layout)
- **Files Modified**:
  - `features/transactions/api/transactions.ts` (added `updateBatch()` function)
  - `features/transactions/hooks/use-transactions.ts` (added `useUpdateTransactionBatch()` hook)
  - `features/transactions/components/transaction-detail-panel.tsx` (complete rewrite to use shared panel)
  - `app/inbox/page.tsx` (switched from card grid to list+panel layout)
- **Impact**:
  - Inbox view now matches Transactions view layout (sidebar | list | detail panel)
  - Both views share identical UX for editing and reviewing transactions
  - Improved data quality through explicit validation and batch save workflow

### 2025-12-25: "Invisible Grouping" Pattern Refactor (Frontend Only)
- **Architecture Change**: Implemented "Strict Hierarchy, Flat UI" pattern for categories
- **Frontend Changes**:
  - **Removed**: Manual transaction type selector (Income/Expense/Opening Balance) from Add Transaction Modal
  - **Added**: Auto-derivation of transaction type from selected category
  - **Refactored**: Category selector to show only leaf categories (flat list)
  - **Added**: `useLeafCategories()` hook to filter and sort categories
  - **Updated**: `TransactionFormData` interface - removed `type` field, added `derivedType` field
  - **Enhanced**: Amount input now displays green (income) or red (expense) based on derived type
  - **Visual Design**: Color dots (3x3px) as primary differentiator, no parent context shown
- **Database**: No schema changes - fully backward compatible
- **Impact**: Opening Balance option no longer available in transaction form (should be set during account creation)
- **Files Modified**:
  - `features/categories/hooks/use-leaf-categories.ts` (NEW)
  - `features/transactions/components/category-selector.tsx` (complete rewrite)
  - `features/transactions/components/transaction-form.tsx` (type derivation + UI changes)
  - `features/transactions/components/add-transaction-modal.tsx` (routing logic updates)

### 2025-12-25: Currency Functions Fix (`20251225155433_fix_currency_functions.sql`)
- **Removed**: `update_account_currencies_updated_at` (orphaned trigger function)
- **Renamed**: `create_account_with_currencies` → `create_account` (simplified to single-currency)
- **Fixed**: `import_transactions` - Now includes `currency_code` when creating accounts
- **Fixed**: `clear_user_data` - Removed references to deleted `account_currencies` and `currencies` tables
- **Fixed**: `replace_account_currency` - Now updates `bank_accounts.currency_code` directly (removed `p_new_starting_balance` parameter)
- **Architecture**: All functions now work with the flat currency model (one currency per account row)

### 2025-12-25: Remove Unused Function (`20251225170617_remove_reconcile_account_balance.sql`)
- **Removed**: `reconcile_account_balance(uuid, numeric)` database function
- **Reason**: Orphaned function - never integrated into application, no RPC calls exist
- **Impact**: None - function was not used anywhere in the codebase

### 2025-12-26: Fix transactions_view for Transaction Detail Panel (`20251226230345_fix_transactions_view_add_missing_fields.sql`)
- **Problem**: Transaction detail panel showed "Select account..." and "Select category..." placeholders instead of displaying current values
- **Root Cause**: The `transactions_view` only included display names (`account_name`, `category_name`) but NOT the IDs (`account_id`, `category_id`) needed for editing
- **Solution**: Dropped and recreated `transactions_view` with complete field set:
  - **Added IDs**: `user_id`, `account_id`, `category_id` (required for editing)
  - **Added Metadata**: `exchange_rate`, `notes`, `transfer_id`, `created_at`, `updated_at`
  - **Added Colors**: `account_color`, `category_color` (for UI indicators)
- **Frontend Changes**:
  - Updated `dbTransactionViewToDomain()` transformer to map new fields
  - Added `accountColor` field to `TransactionView` domain type
  - Fixed inbox table transformation to include `accountColor: null`
  - Updated transaction list UI: Category tags now show color as background/text/border (removed vertical bar and dot)
- **Impact**: Transaction detail panel now correctly displays selected account and category when editing transactions
- **Migration**: Requires database migration via Supabase CLI, then TypeScript type regeneration

### 2025-12-27: Account Name Normalization (`20251227140411_fix_import_account_lookup.sql` + `20251227140449_clean_account_names.sql`)
- **Problem**: Account names contained redundant currency codes in parentheses (e.g., `"BCP Credito (PEN)"`)
- **UI Impact**: Account selectors displayed `"BCP Credito (PEN) S/"` showing BOTH currency code AND symbol
- **Solution**: Two-phase database migration approach:

#### Phase 1: Fix Import Logic (`20251227140411_fix_import_account_lookup.sql`)
- **Purpose**: Prevent import failures when account names are cleaned
- **Change**: Modified `import_transactions` function to identify accounts by **name + currency** (not just name)
- **Before**: `WHERE user_id = p_user_id AND lower(name) = lower(v_account_name)`
- **After**: `WHERE user_id = p_user_id AND lower(name) = lower(v_account_name) AND currency_code = v_currency_code`
- **Why Critical**: After name cleaning, "Savings (USD)" and "Savings (PEN)" both become "Savings"
  - Without currency filter → query returns BOTH rows → "multiple rows returned" error
  - With currency filter → correctly picks the USD or PEN version

#### Phase 2: Clean Names + Add Constraint (`20251227140449_clean_account_names.sql`)
- **Data Cleaning**: Removed currency code suffixes using SQL regex pattern
  - Pattern: `\s\([A-Z]{3,4}\)$` (space + parentheses + 3-4 uppercase letters at end)
  - Examples:
    - `"BCP Credito (PEN)"` → `"BCP Credito"`
    - `"Savings (Joint) (USD)"` → `"Savings (Joint)"` (preserves middle parentheses)
    - `"Chase (EUR)"` → `"Chase"`
- **Uniqueness Constraint**: Added `UNIQUE (user_id, name, currency_code)` to `bank_accounts` table
  - Allows: Same account name in different currencies (e.g., "Savings" in USD and EUR)
  - Prevents: Duplicate accounts with same user + name + currency

#### Frontend Cleanup (Phase 4)
- **Removed Dead Code**: All name-cleaning logic deleted from frontend hooks
- **Files Modified**:
  - `hooks/use-flat-accounts.ts` - Removed `cleanName` field generation and regex cleaning
    - Type `FlatAccount` simplified from `AccountBalance & { cleanName: string }` to just `AccountBalance`
    - Sorting now uses `account.name` directly instead of `account.cleanName`
  - `hooks/use-grouped-accounts.ts` - Removed `split(' (')[0]` string manipulation
    - Uses database name directly: `const name = first.name ?? ACCOUNT_UI.LABELS.UNKNOWN_ACCOUNT`
  - `features/accounts/components/account-list-item.tsx` - Changed `{account.cleanName}` to `{account.name}`
- **Result**: Database is single source of truth, no frontend transformations needed

#### Architectural Benefits
- **Single Source of Truth**: Currency code stored once in `currency_code` column (not redundantly in name)
- **Performance**: Eliminated unnecessary string processing on every render
- **Maintainability**: Simpler codebase with fewer transformations
- **Data Integrity**: Uniqueness constraint prevents duplicate accounts
- **UI Correctness**: Account selectors now display `"BCP Credito S/"` (clean) instead of `"BCP Credito (PEN) S/"` (redundant)

#### Migration Order (CRITICAL)
1. ✅ Phase 1: Fix import logic (MUST run first)
2. ✅ Phase 2: Clean names + add constraint
3. ✅ Phase 4: Remove frontend cleaning code
- **DO NOT** run Phase 2 before Phase 1 (will break imports!)