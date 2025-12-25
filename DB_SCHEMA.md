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

### Opening Balance Pattern
Opening balance transactions are identified by:
- `category_id = NULL`
- `transfer_id = NULL`
- `description = 'Opening Balance'`

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
| **current_balance** | numeric | NO | `0` | **[NEW]** The live ledger balance. Updated automatically via triggers. |

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

| Column | Type | Description |
|---|---|---|
| **id** | uuid | Transaction ID |
| **date** | timestamptz | Transaction date |
| **description** | text | Transaction description |
| **amount_original** | numeric | Amount in original currency |
| **amount_home** | numeric | Amount in home currency |
| **currency_original** | text | Original currency code |
| **category_name** | text | Name of the associated category |
| **category_type** | transaction_type | Type of the associated category |
| **account_name** | text | Name of the associated account |
| **account_currency** | text | Currency of the associated account |

---

## ⚡ Functions (PL/pgSQL)

### Core Account & Transaction Functions

| Function Name | Return Type | Arguments | Description |
|---|---|---|---|
| `create_account` | `jsonb` | `p_account_name text`, `p_account_color text`, `p_currency_code text`, `p_starting_balance numeric DEFAULT 0`, `p_account_type account_type DEFAULT 'checking'` | **[UPDATED 2025-12-25]** Creates a single account with one currency and optional opening balance. Simplified from old multi-currency version. |
| `create_account_group` | `json` | `p_user_id uuid`, `p_name text`, `p_color text`, `p_type account_type`, `p_currencies text[]` | Creates a new account group with separate account rows for each currency (linked by `group_id`) |
| `import_transactions` | `jsonb` | `p_user_id uuid`, `p_transactions jsonb`, `p_default_account_color text`, `p_default_category_color text` | **[FIXED 2025-12-25]** Imports a batch of transactions from JSON array. Auto-creates accounts with `currency_code`. Fixed to work with flat architecture. |
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
| `reconcile_account_balance` | `uuid` | `p_account_id uuid`, `p_new_balance numeric` | Creates a "Delta Transaction" to fix balance discrepancies (Snapshot logic) |

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

### 2025-12-25: Currency Functions Fix (`20251225155433_fix_currency_functions.sql`)
- **Removed**: `update_account_currencies_updated_at` (orphaned trigger function)
- **Renamed**: `create_account_with_currencies` → `create_account` (simplified to single-currency)
- **Fixed**: `import_transactions` - Now includes `currency_code` when creating accounts
- **Fixed**: `clear_user_data` - Removed references to deleted `account_currencies` and `currencies` tables
- **Fixed**: `replace_account_currency` - Now updates `bank_accounts.currency_code` directly (removed `p_new_starting_balance` parameter)
- **Architecture**: All functions now work with the flat currency model (one currency per account row)