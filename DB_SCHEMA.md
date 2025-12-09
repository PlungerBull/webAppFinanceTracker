# Database Schema Documentation

**Project:** Finance Tracker Web
**Framework:** Supabase (PostgreSQL)
**Last Updated:** [Current Date]

---

## 1. Enums (Custom Types)

### `account_type`
*Used to classify bank accounts.*
* `checking`
* `savings`
* `credit_card`
* `investment`
* `loan`
* `cash`
* `other`

### `transaction_type`
*Used to classify the nature of a transaction.*
* `income`
* `expense`
* `transfer`
* `adjustment`
* `opening_balance`

---

## 2. Tables (Public Schema)

### `bank_accounts`
*Stores user financial accounts.*
* **Primary Key:** `id`
* **Columns:**
  * `id` (uuid)
  * `user_id` (uuid) → *Links to auth.users*
  * `name` (text)
  * `color` (text)
  * `is_visible` (boolean)
  * `created_at` (timestamptz)
  * `updated_at` (timestamptz)

### `categories`
*Income and expense categories with hierarchy.*
* **Primary Key:** `id`
* **Columns:**
  * `id` (uuid)
  * `user_id` (uuid, Optional)
  * `parent_id` (uuid, Optional) → *Self-reference for subcategories*
  * `name` (text)
  * `color` (text)
  * `type` (text)
  * `created_at` (timestamptz)
  * `updated_at` (timestamptz)

### `transactions`
*The central ledger for all financial activity.*
* **Primary Key:** `id`
* **Columns:**
  * `id` (uuid)
  * `user_id` (uuid)
  * `account_id` (uuid) → *Links to bank_accounts*
  * `category_id` (uuid, Optional) → *Links to categories*
  * `transfer_id` (uuid, Optional) → *Groups linked transfers*
  * `date` (timestamptz)
  * `description` (text, Optional)
  * `amount_original` (numeric)
  * `amount_home` (numeric)
  * `currency_original` (text)
  * `exchange_rate` (numeric)
  * `notes` (text, Optional)
  * `created_at` (timestamptz)
  * `updated_at` (timestamptz)

### `global_currencies`
*Reference table for supported currencies.*
* **Primary Key:** `code`
* **Columns:**
  * `code` (text)
  * `name` (text)
  * `symbol` (text)
  * `flag` (text, Optional)

### `account_currencies`
*Junction table linking accounts to specific currencies.*
* **Columns:**
  * `id` (uuid)
  * `account_id` (uuid)
  * `currency_code` (varchar)
  * `created_at` (timestamptz, Optional)
  * `updated_at` (timestamptz, Optional)

### `user_settings`
*User-specific application preferences.*
* **Columns:**
  * `user_id` (uuid)
  * `main_currency` (text, Optional)
  * `theme` (text, Optional)
  * `start_of_week` (integer, Optional)
  * `created_at` (timestamptz)
  * `updated_at` (timestamptz)

---

## 3. Database Views (Virtual Tables)

### `account_balances`
*Calculates live balances by summing transactions per account.*
* **Returns:** `account_id`, `current_balance`, `name`, `color`, `currency`, `is_visible`...

### `transactions_view`
*Enriches raw transactions with joined names (account/category names).*
* **Returns:** `id`, `date`, `description`, `amount_home`, `category_name`, `account_name`...

### `categories_with_counts`
*Categories enriched with usage statistics.*
* **Returns:** `id`, `name`, `transaction_count`, `type`...

### `parent_categories_with_counts`
*Aggregated stats for top-level groupings.*
* **Returns:** `id`, `name`, `transaction_count`, `parent_id`...

---

## 4. API Functions (RPCs)
*Callable from the frontend via `supabase.rpc()`.*

### `create_transfer`
*Creates two linked transactions (withdrawal + deposit) in one atomic step.*
* **Arguments:** `p_user_id`, `p_from_account_id`, `p_to_account_id`, `p_amount`, `p_exchange_rate`...
* **Returns:** `json`

### `create_account_with_currencies`
*Creates an account and initializes its currency list.*
* **Arguments:** `p_account_name`, `p_account_color`, `p_currencies` (jsonb)
* **Returns:** `jsonb`

### `get_monthly_spending_by_category`
*Aggregates spending for charts/graphs.*
* **Arguments:** `p_months_back` (int), `p_user_id` (uuid)
* **Returns:** Table of category stats per month.

### `import_transactions`
*Bulk insert function for CSV imports.*
* **Arguments:** `p_transactions` (jsonb), `p_user_id`...
* **Returns:** `jsonb`

### `replace_account_currency`
*Swaps the currency of an account and recalculates balances.*
* **Arguments:** `p_account_id`, `p_old_currency_code`, `p_new_currency_code`...
* **Returns:** `void`

### `clear_user_data`
*Hard deletes all data for a specific user (Reset Account).*
* **Arguments:** `p_user_id`
* **Returns:** `void`

### `delete_transfer`
*Deletes both legs of a transfer.*
* **Arguments:** `p_transfer_id`
* **Returns:** `void`

---

## 5. Internal Trigger Functions
*Automatic logic executed on DB events. Not callable from API.*

* **`handle_new_user`**: Sets up default settings/categories when a user signs up.
* **`calculate_amount_home`**: Automatically converts `amount_original` to `amount_home` using the exchange rate.
* **`validate_category_hierarchy_func`**: Prevents circular dependencies in categories.
* **`cascade_color_to_children`**: If a parent category color changes, update children.
* **`sync_category_type_hierarchy`**: Enforces parent-child type consistency (income/expense). When a parent's type changes, automatically updates all children. When a child is inserted or moved, it inherits the parent's type.
* **`cleanup_orphaned_categories`**: Maintenance function to fix data integrity.
* **`update_updated_at_column`**: Auto-updates the `updated_at` timestamp on edit.