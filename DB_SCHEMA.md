# Database Documentation
Generated on: 2025-12-09

## Tables

### 📄 Table: bank_accounts

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| **id** | uuid | NO | `uuid_generate_v4()` |  |
| **user_id** | uuid | NO | `-` |  |
| **name** | text | NO | `-` |  |
| **created_at** | timestamptz | NO | `now()` |  |
| **updated_at** | timestamptz | NO | `now()` |  |
| **color** | text | NO | `'#3b82f6'::text` | Hex color code for visual identification of the account (e.g., #3b82f6) |
| **is_visible** | bool | NO | `true` |  |
| **currency_code** | text | NO | `'USD'::text` |  |
| **group_id** | uuid | NO | `gen_random_uuid()` |  |
| **type** | account_type | NO | `'checking'::account_type` |  |

---

### 📄 Table: categories

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| **id** | uuid | NO | `uuid_generate_v4()` |  |
| **user_id** | uuid | YES | `-` |  |
| **name** | text | NO | `-` |  |
| **color** | text | NO | `-` |  |
| **created_at** | timestamptz | NO | `now()` |  |
| **updated_at** | timestamptz | NO | `now()` |  |
| **parent_id** | uuid | YES | `-` |  |
| **type** | transaction_type | NO | `'expense'::transaction_type` |  |

---

### 📄 Table: global_currencies

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| **code** | text | NO | `-` |  |
| **name** | text | NO | `-` |  |
| **symbol** | text | NO | `-` |  |
| **flag** | text | YES | `-` |  |

---

### 📄 Table: transactions

> Transactions table. Type is determined implicitly: transfer (transfer_id NOT NULL), opening balance (category_id NULL and transfer_id NULL), or standard (category_id NOT NULL with type from category).

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| **id** | uuid | NO | `uuid_generate_v4()` |  |
| **user_id** | uuid | NO | `-` |  |
| **account_id** | uuid | NO | `-` |  |
| **category_id** | uuid | YES | `-` |  |
| **date** | timestamptz | NO | `now()` |  |
| **description** | text | YES | `-` |  |
| **amount_original** | numeric | NO | `-` |  |
| **currency_original** | text | NO | `-` |  |
| **exchange_rate** | numeric | NO | `1.0` |  |
| **amount_home** | numeric | NO | `-` |  |
| **transfer_id** | uuid | YES | `-` |  |
| **created_at** | timestamptz | NO | `now()` |  |
| **updated_at** | timestamptz | NO | `now()` |  |
| **notes** | text | YES | `-` | Optional notes or memo for the transaction |

---

### 📄 Table: user_settings

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| **user_id** | uuid | NO | `-` |  |
| **theme** | text | YES | `'system'::text` |  |
| **start_of_week** | int4 | YES | `0` |  |
| **created_at** | timestamptz | NO | `now()` |  |
| **updated_at** | timestamptz | NO | `now()` |  |
| **main_currency** | text | YES | `'USD'::text` |  |

---

## Views

### 👁️ View: account_balances

| Column | Type | Description |
|---|---|---|
| **account_id** | uuid |  |
| **group_id** | uuid |  |
| **name** | text |  |
| **currency_code** | text |  |
| **type** | account_type |  |
| **current_balance** | numeric |  |

---

### 👁️ View: categories_with_counts

| Column | Type | Description |
|---|---|---|
| **id** | uuid |  |
| **name** | text |  |
| **type** | transaction_type |  |
| **parent_id** | uuid |  |
| **transaction_count** | int8 |  |

---

### 👁️ View: transactions_view

| Column | Type | Description |
|---|---|---|
| **id** | uuid |  |
| **date** | timestamptz |  |
| **description** | text |  |
| **amount_original** | numeric |  |
| **amount_home** | numeric |  |
| **currency_original** | text |  |
| **category_name** | text |  |
| **category_type** | transaction_type |  |
| **account_name** | text |  |
| **account_currency** | text |  |

---

## Functions

### ⚡ Function: update_account_currencies_updated_at
- **Return Type:** `trigger`
- **Arguments:** ``
- **Language:** `plpgsql`

---

### ⚡ Function: handle_new_user
- **Return Type:** `trigger`
- **Arguments:** ``
- **Language:** `plpgsql`

---

### ⚡ Function: sync_category_type_hierarchy
- **Return Type:** `trigger`
- **Arguments:** ``
- **Language:** `plpgsql`

---

### ⚡ Function: update_updated_at_column
- **Return Type:** `trigger`
- **Arguments:** ``
- **Language:** `plpgsql`

---

### ⚡ Function: delete_transfer
- **Return Type:** `void`
- **Arguments:** `p_user_id uuid, p_transfer_id uuid`
- **Language:** `plpgsql`

---

### ⚡ Function: get_monthly_spending_by_category
- **Return Type:** `TABLE(category_id uuid, category_name text, category_icon text, month_key text, total_amount numeric)`
- **Arguments:** `p_user_id uuid, p_months_back integer DEFAULT 6`
- **Language:** `plpgsql`

---

### ⚡ Function: import_transactions
- **Return Type:** `jsonb`
- **Arguments:** `p_user_id uuid, p_transactions jsonb, p_default_account_color text, p_default_category_color text`
- **Language:** `plpgsql`

---

### ⚡ Function: calculate_amount_home
- **Return Type:** `trigger`
- **Arguments:** ``
- **Language:** `plpgsql`

---

### ⚡ Function: clear_user_data
- **Return Type:** `void`
- **Arguments:** `p_user_id uuid`
- **Language:** `plpgsql`

---

### ⚡ Function: create_account_with_currencies
- **Return Type:** `jsonb`
- **Arguments:** `p_account_name text, p_account_color text, p_currencies jsonb`
- **Language:** `plpgsql`

---

### ⚡ Function: create_transfer
- **Return Type:** `json`
- **Arguments:** `p_user_id uuid, p_from_account_id uuid, p_to_account_id uuid, p_amount numeric, p_from_currency text, p_to_currency text, p_amount_received numeric, p_exchange_rate numeric, p_date timestamp with time zone, p_description text, p_category_id uuid`
- **Language:** `plpgsql`

---

### ⚡ Function: replace_account_currency
- **Return Type:** `void`
- **Arguments:** `p_account_id uuid, p_old_currency_code character varying, p_new_currency_code character varying, p_new_starting_balance numeric`
- **Language:** `plpgsql`

---

### ⚡ Function: sync_child_category_color
- **Return Type:** `trigger`
- **Arguments:** ``
- **Language:** `plpgsql`

---

### ⚡ Function: cascade_color_to_children
- **Return Type:** `trigger`
- **Arguments:** ``
- **Language:** `plpgsql`

---

### ⚡ Function: validate_category_hierarchy_func
- **Return Type:** `trigger`
- **Arguments:** ``
- **Language:** `plpgsql`

---

### ⚡ Function: check_transaction_category_hierarchy
- **Return Type:** `trigger`
- **Arguments:** ``
- **Language:** `plpgsql`

---

### ⚡ Function: create_account_group
- **Return Type:** `json`
- **Arguments:** `p_user_id uuid, p_name text, p_color text, p_type account_type, p_currencies text[]`
- **Language:** `plpgsql`

---

### ⚡ Function: cleanup_orphaned_categories
- **Return Type:** `TABLE(category_id uuid, category_name text, was_orphaned boolean)`
- **Arguments:** ``
- **Language:** `plpgsql`