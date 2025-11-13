# Finance Tracker - Developer Guidelines

**Version:** 1.0  
**Last Updated:** November 2025  
**Status:** Active Development

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Database Architecture](#database-architecture)
4. [Project Structure](#project-structure)
5. [Features & Requirements](#features--requirements)
6. [Development Standards](#development-standards)
7. [API Guidelines](#api-guidelines)
8. [Security Requirements](#security-requirements)
9. [Testing Strategy](#testing-strategy)
10. [Deployment](#deployment)

---

## Project Overview

### Purpose

A personal finance tracking application that helps users manage their money across multiple accounts and currencies with a beautiful, intuitive interface. The app emphasizes:

- **Simplicity** - Quick, friction-free data entry
- **Multi-currency** - Essential for dual-currency economies
- **Offline-first** - Works instantly, syncs in background
- **Privacy** - Users own their data, can export anytime
- **Quality** - Todoist-level polish and reliability

### Target Users

- Individuals managing personal finances
- Users in dual-currency economies (e.g., Peru: USD + PEN)
- People wanting to track income, expenses, and transfers
- Privacy-conscious users who want data ownership

### Vision

Part of a larger productivity ecosystem:
1. **Phase 1:** Finance Tracker (current)
2. **Phase 2:** Todo/Task Manager
3. **Phase 3:** Notes App
4. **Phase 4:** Communication Hub

All apps share the same Supabase backend and sync across platforms.

---

## Tech Stack

### Frontend - Web

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 14+ | React framework with App Router |
| **TypeScript** | 5+ | Type safety |
| **React** | 18+ | UI library |
| **Tailwind CSS** | 3+ | Styling |
| **shadcn/ui** | Latest | UI component library |
| **TanStack Query** | 5+ | Server state management |
| **Zustand** | 4+ | Client state management |
| **React Hook Form** | 7+ | Form handling |
| **Zod** | 3+ | Schema validation |
| **Recharts** | 2+ | Data visualization |
| **date-fns** | 3+ | Date utilities |
| **Lucide React** | Latest | Icons |

### Frontend - iOS (Phase 2)

| Technology | Purpose |
|------------|---------|
| **Swift** | Native iOS development |
| **SwiftUI** | UI framework |
| **Core Data** | Local storage |
| **Combine** | Reactive programming |

### Backend

| Technology | Purpose |
|------------|---------|
| **Supabase** | Backend-as-a-Service |
| **PostgreSQL** | Database |
| **Row Level Security (RLS)** | Data isolation |
| **Edge Functions** | Serverless functions (Deno) |

### DevOps

| Technology | Purpose |
|------------|---------|
| **Vercel** | Web hosting |
| **GitHub Actions** | CI/CD |
| **Sentry** | Error tracking (production) |

---

## Database Architecture

### Overview

Single PostgreSQL database hosted on Supabase, shared by all platforms (Web, iOS, Android).

### Core Principles

1. **User Isolation** - Users can ONLY see their own data (enforced by RLS)
2. **Referential Integrity** - Foreign keys maintain data consistency
3. **Soft Deletes** - Consider soft deletes for important data (future)
4. **Audit Trail** - `created_at` and `updated_at` on all tables

### Entity Relationship Diagram

```
┌─────────────┐
│ auth.users  │ (Supabase managed)
└──────┬──────┘
       │
       ├─────────────┐
       │             │
       ▼             ▼
┌─────────────┐  ┌──────────────┐
│bank_accounts│  │  currencies  │
└──────┬──────┘  └──────────────┘
       │
       ├────────────┐
       │            │
       ▼            ▼
┌────────────────┐ ┌──────────────┐
│account_currencies│ │ transactions │
│  (junction)   │ └──────┬───────┘
└────────────────┘        │
                          ▼
                    ┌──────────────┐
                    │  categories  │
                    └──────────────┘
                    (self-join via transfer_id)
```

### Table Schemas

#### 1. `bank_accounts`

Stores user's financial accounts (checking, savings, cash, credit cards, etc.)

```sql
CREATE TABLE bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                    -- e.g., "Checking", "Savings", "Credit Card"
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_bank_accounts_user_id ON bank_accounts(user_id);

-- RLS Policies
CREATE POLICY "Users can view their own accounts"
    ON bank_accounts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own accounts"
    ON bank_accounts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own accounts"
    ON bank_accounts FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own accounts"
    ON bank_accounts FOR DELETE
    USING (auth.uid() = user_id);
```

**Business Rules:**
- Account names must be unique per user
- Currencies and balances stored in `account_currencies` junction table
- Supports multiple currencies per account (essential for credit cards)
- Deleting account deletes all related transactions and currencies (CASCADE)

---

#### 2. `account_currencies` (Multi-Currency Support)

Junction table linking accounts to currencies with starting balances.

```sql
CREATE TABLE account_currencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    currency_code VARCHAR(3) NOT NULL,     -- ISO 4217 code (USD, PEN, EUR)
    starting_balance NUMERIC(15, 2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, currency_code)      -- One entry per account-currency pair
);

-- Indexes
CREATE INDEX idx_account_currencies_account_id ON account_currencies(account_id);
CREATE INDEX idx_account_currencies_currency_code ON account_currencies(currency_code);

-- RLS Policies (indirect ownership through bank_accounts)
CREATE POLICY "Users can view their own account currencies"
    ON account_currencies FOR SELECT
    USING (
        account_id IN (
            SELECT id FROM bank_accounts WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their own account currencies"
    ON account_currencies FOR ALL
    USING (
        account_id IN (
            SELECT id FROM bank_accounts WHERE user_id = auth.uid()
        )
    );
```

**Business Rules:**
- One account can have multiple currencies
- Each currency has its own starting balance
- Perfect for credit cards supporting multiple currencies
- Current balance per currency = starting_balance + SUM(transactions in that currency)
- Cannot have duplicate currency for same account (UNIQUE constraint)

---

#### 3. `transactions`

Stores all financial transactions (income, expenses, transfers)

```sql
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT,
    
    -- Multi-currency fields
    amount_original NUMERIC(15, 2) NOT NULL,      -- Positive = income, Negative = expense
    currency_original TEXT NOT NULL,              -- Currency of transaction
    exchange_rate NUMERIC(15, 6) NOT NULL DEFAULT 1.0,
    amount_home NUMERIC(15, 2) NOT NULL,         -- Converted to main currency
    
    -- Transfer linking
    transfer_id UUID,                             -- Links two transactions
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_category_id ON transactions(category_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_transfer_id ON transactions(transfer_id);

-- RLS Policies (similar to bank_accounts)
-- ... (same pattern as above)
```

**Business Rules:**
- **Positive amount** (`amount_original` > 0): Income, refund, or any money received
- **Negative amount** (`amount_original` < 0): Expense, purchase, or any money spent
- **Transfer**: Two transactions with same `transfer_id`
  - One negative (debit from source)
  - One positive (credit to destination)
- Income vs Expense is determined by **sign only**, not by category
- A single category (e.g., "Food & Dining") can have both:
  - Negative transactions: -$50 (bought groceries)
  - Positive transactions: +$10 (returned item, got refund)
- `amount_home = amount_original * exchange_rate`
- If `currency_original == user's main currency`, then `exchange_rate = 1.0`
- Transfers MUST be created atomically (use `create_transfer` RPC)

---

#### 4. `categories`

Categorizes transactions by spending area (not by income/expense)

```sql
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL for system defaults
    name TEXT NOT NULL,
    icon TEXT NOT NULL,                        -- Emoji or icon identifier
    color TEXT NOT NULL,                       -- Hex color code
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_categories_user_id ON categories(user_id);

-- RLS Policies
CREATE POLICY "Users can view default and their own categories"
    ON categories FOR SELECT
    USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users can insert their own categories"
    ON categories FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update any categories"
    ON categories FOR UPDATE
    USING (user_id IS NULL OR auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete any categories"
    ON categories FOR DELETE
    USING (user_id IS NULL OR auth.uid() = user_id);
```

**Business Rules:**
- Default categories have `user_id = NULL` (system-provided)
- User-created categories have `user_id = <user>`
- Users CAN delete default categories (they'll be hidden for that user)
- Categories can have both positive (income/refund) and negative (expense) transactions
- A "Food & Dining" category can have:
  - -$50 (expense: groceries)
  - +$10 (refund: returned item)
- Category names should be unique per user

**Philosophy:**
- Income/Expense is just about the **sign** (+/-), not category types
- Categories represent **spending areas**, not transaction types
- Example: "Food & Dining" typically has expenses (-), but can have refunds (+)
- This is simpler and more flexible than separate category systems

**Default Categories:**
- 🍔 Food & Dining
- 🚗 Transportation  
- 🏠 Housing
- 💼 Salary & Income
- 🛒 Shopping
- 💊 Healthcare
- 🎬 Entertainment
- 📱 Utilities
- 🎓 Education
- 💳 Fees & Charges
- 🎁 Gifts
- 💰 Other

---

#### 5. `currencies`

Tracks which currencies each user uses

```sql
CREATE TABLE currencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code TEXT NOT NULL,                        -- ISO 4217: "USD", "PEN", "EUR"
    is_main BOOLEAN DEFAULT FALSE,             -- User's primary currency
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, code)                      -- Prevent duplicates
);

-- Indexes
CREATE INDEX idx_currencies_user_id ON currencies(user_id);

-- RLS Policies (standard pattern)
-- ...
```

**Business Rules:**
- Each user has exactly ONE main currency (`is_main = TRUE`)
- User cannot have duplicate currency codes
- All reports/insights show values in main currency
- When user changes main currency, update `is_main` flag (single UPDATE)

---

#### 6. `user_settings`

User preferences and configuration

```sql
CREATE TABLE user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
    start_of_week INTEGER DEFAULT 0 CHECK (start_of_week BETWEEN 0 AND 6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policies (standard pattern)
-- ...
```

**Business Rules:**
- Created automatically on user signup (via trigger or app logic)
- `start_of_week`: 0 = Sunday, 1 = Monday, etc.

---

### Database Functions

#### `create_transfer()`

Atomically creates a transfer between two accounts.

**Why needed:** Transfers create TWO transactions. If one fails, data becomes corrupted. This function ensures both succeed or both fail (ACID transaction).

```sql
CREATE OR REPLACE FUNCTION create_transfer(
    p_user_id UUID,
    p_from_account_id UUID,
    p_to_account_id UUID,
    p_amount NUMERIC,
    p_currency_original TEXT,
    p_exchange_rate NUMERIC,
    p_description TEXT,
    p_date TIMESTAMPTZ,
    p_category_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transfer_id UUID;
    v_transaction_1_id UUID;
    v_transaction_2_id UUID;
    v_amount_home NUMERIC;
BEGIN
    -- Validate user owns both accounts
    IF NOT EXISTS (
        SELECT 1 FROM bank_accounts 
        WHERE id = p_from_account_id AND user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'From account not found or unauthorized';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM bank_accounts 
        WHERE id = p_to_account_id AND user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'To account not found or unauthorized';
    END IF;
    
    -- Generate transfer ID to link both transactions
    v_transfer_id := uuid_generate_v4();
    
    -- Calculate home currency amount
    v_amount_home := p_amount * p_exchange_rate;
    
    -- Create debit transaction (from account)
    INSERT INTO transactions (
        user_id, account_id, amount_original, currency_original,
        exchange_rate, amount_home, description, date,
        category_id, transfer_id
    ) VALUES (
        p_user_id, p_from_account_id, -p_amount, p_currency_original,
        p_exchange_rate, -v_amount_home, p_description, p_date,
        p_category_id, v_transfer_id
    ) RETURNING id INTO v_transaction_1_id;
    
    -- Create credit transaction (to account)
    INSERT INTO transactions (
        user_id, account_id, amount_original, currency_original,
        exchange_rate, amount_home, description, date,
        category_id, transfer_id
    ) VALUES (
        p_user_id, p_to_account_id, p_amount, p_currency_original,
        p_exchange_rate, v_amount_home, p_description, p_date,
        p_category_id, v_transfer_id
    ) RETURNING id INTO v_transaction_2_id;
    
    -- Return both transaction IDs
    RETURN json_build_object(
        'transfer_id', v_transfer_id,
        'debit_transaction_id', v_transaction_1_id,
        'credit_transaction_id', v_transaction_2_id
    );
END;
$$;
```

**Usage from client:**
```typescript
const result = await supabase.rpc('create_transfer', {
  p_user_id: userId,
  p_from_account_id: 'acc-1',
  p_to_account_id: 'acc-2',
  p_amount: 100,
  p_currency_original: 'USD',
  p_exchange_rate: 1.0,
  p_description: 'Transfer to savings',
  p_date: new Date().toISOString(),
});
```

---

#### `delete_transfer()`

Atomically deletes both transactions in a transfer.

```sql
CREATE OR REPLACE FUNCTION delete_transfer(
    p_user_id UUID,
    p_transfer_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM transactions
    WHERE user_id = p_user_id AND transfer_id = p_transfer_id;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    IF v_deleted_count != 2 THEN
        RAISE EXCEPTION 'Transfer not found or incomplete';
    END IF;
END;
$$;
```

---

### Database Views

#### `account_balances`

Pre-calculates account balances for performance.

```sql
CREATE OR REPLACE VIEW account_balances AS
SELECT 
    ba.id,
    ba.user_id,
    ba.name,
    ba.currency,
    ba.starting_balance,
    COALESCE(SUM(t.amount_original), 0) as transaction_sum,
    ba.starting_balance + COALESCE(SUM(t.amount_original), 0) as current_balance
FROM bank_accounts ba
LEFT JOIN transactions t ON t.account_id = ba.id
GROUP BY ba.id, ba.user_id, ba.name, ba.currency, ba.starting_balance;

GRANT SELECT ON account_balances TO authenticated;
```

**Usage:**
```typescript
// Get account with pre-calculated balance
const { data } = await supabase
  .from('account_balances')
  .select('*')
  .eq('id', accountId)
  .single();

console.log(data.current_balance); // ✅ Already calculated
```

---

### Database Triggers

#### Auto-update `updated_at`

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
CREATE TRIGGER update_bank_accounts_updated_at 
    BEFORE UPDATE ON bank_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at 
    BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- etc. for other tables
```

---

## Project Structure

### Overview

Feature-based architecture for scalability and maintainability.

```
finance-tracker-web/
├── src/
│   ├── app/                    # Next.js routes (thin)
│   ├── features/               # Business logic by feature
│   ├── components/             # Shared components
│   ├── lib/                    # Core utilities
│   ├── hooks/                  # Global hooks
│   ├── providers/              # Context providers
│   ├── stores/                 # Global state
│   ├── types/                  # TypeScript types
│   └── config/                 # Configuration
├── public/                     # Static assets
└── tests/                      # Test files
```

### Feature Structure

Each feature is self-contained:

```
features/transactions/
├── components/           # UI components
├── hooks/               # React Query hooks
├── api/                 # Supabase API calls
├── types/               # Feature-specific types
├── utils/               # Helper functions
└── constants/           # Feature constants
```

**Example: `features/transactions/api/transactions.ts`**

```typescript
import { supabase } from '@/lib/supabase/client';
import type { Transaction, NewTransaction } from '../types';

export const transactionsApi = {
  getAll: async (filters?: TransactionFilters): Promise<Transaction[]> => {
    let query = supabase
      .from('transactions')
      .select(`
        *,
        account:bank_accounts(name, currency),
        category:categories(name, icon, color)
      `)
      .order('date', { ascending: false });

    if (filters?.accountId) {
      query = query.eq('account_id', filters.accountId);
    }

    if (filters?.startDate) {
      query = query.gte('date', filters.startDate);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  create: async (transaction: NewTransaction): Promise<Transaction> => {
    const { data, error } = await supabase
      .from('transactions')
      .insert(transaction)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  createTransfer: async (transfer: TransferInput) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('Not authenticated');

    const { data, error } = await supabase.rpc('create_transfer', {
      p_user_id: user.user.id,
      p_from_account_id: transfer.fromAccountId,
      p_to_account_id: transfer.toAccountId,
      p_amount: transfer.amount,
      p_currency_original: transfer.currency,
      p_exchange_rate: transfer.exchangeRate,
      p_description: transfer.description,
      p_date: transfer.date,
    });

    if (error) throw error;
    return data;
  },
};
```

---

## Features & Requirements

### MVP Features (Phase 1)

#### 1. Authentication
- **Sign up** with email/password
- **Login** with email/password
- **Password reset** flow
- **Session management** (JWT)
- **Protected routes**

**Implementation:**
- Use Supabase Auth
- Store session in cookies (server-side)
- Auth state in Zustand store
- Redirect unauthenticated users to login

---

#### 2. Account Management

**Features:**
- ✅ Create account (name, starting balance, currency)
- ✅ View all accounts
- ✅ Edit account details
- ✅ Delete account (with confirmation)
- ✅ View account balance (from `account_balances` view)
- ✅ View account transactions

**Business Rules:**
- Minimum 1 account required
- Account names must be unique per user
- Deleting account deletes all transactions (CASCADE)
- Show warning before deletion

**UI Requirements:**
- Account cards showing: name, balance, currency, transaction count
- "Add Account" button (prominent)
- Edit/delete actions (swipe or dropdown)
- Confirmation dialog before deletion

---

#### 3. Transaction Management

**Features:**
- ✅ Add transaction (positive or negative amount)
- ✅ Create transfer between accounts
- ✅ Edit transaction
- ✅ Delete transaction
- ✅ View transaction list (grouped by date)
- ✅ Filter transactions (by date, account, category)
- ✅ Search transactions

**Business Rules:**
- User selects "Income" or "Expense" → determines sign automatically
  - Income: saves as positive `amount_original` (+20)
  - Expense: saves as negative `amount_original` (-20)
- User doesn't type negative signs - the UI handles it
- Categories are NOT split by type:
  - "Food & Dining" can have expenses (-$50) and refunds (+$10)
  - "Salary" can have income (+$3000) and deductions (-$50)
- Transfer: use `create_transfer` RPC (atomic)
- Multi-currency: prompt for exchange rate if currency ≠ account currency
- Same currency: `exchange_rate = 1.0`

**UI Requirements:**
- Transaction type selector: 
  - **Income** button → saves positive amount
  - **Expense** button → saves negative amount  
  - **Transfer** button → opens transfer form
- Amount input: User types "20", app converts to +20 or -20 based on selection
- Category selector shows ALL categories (not filtered by type)
- Transaction list with visual indicators:
  - Green + for positive amounts (income, refunds)
  - Red - for negative amounts (expenses)
  - Blue 🔄 for transfers
- Date grouping (Today, Yesterday, This Week, etc.)
- Swipe actions (edit, delete)

**Example Flow:**
```
User taps "Expense" → Form opens
User types "50" in amount field
User selects "Food & Dining" category
User taps Save
→ Saves: amount_original = -50

Later, user got a refund:
User taps "Income" → Form opens
User types "10" in amount field
User selects "Food & Dining" category (same as before!)
User taps Save
→ Saves: amount_original = +10

Result: "Food & Dining" has both -50 and +10 transactions
```

---

#### 4. Category Management

**Features:**
- ✅ View all categories (system defaults + user's custom)
- ✅ Create custom category
- ✅ Edit any category (including defaults)
- ✅ Delete any category (including defaults)
- ✅ Hide/archive categories instead of deleting

**Business Rules:**
- Categories are NOT split by income/expense
- Same category can have positive (income/refunds) and negative (expenses) transactions
- Example: "Food & Dining" category has:
  - -$50 (expense: groceries)
  - +$10 (refund: returned spoiled food)
- Users can delete system default categories (just hides them for that user)
- Deleting category with transactions: 
  - Option 1: Set `category_id = NULL` on transactions (orphan them)
  - Option 2: Prevent deletion, require reassignment first
  - Recommended: Soft delete (add `deleted_at` column)

**UI Requirements:**
- Single category list (not split by type)
- Icon picker (emoji selector)
- Color picker
- "Add Category" button
- Edit/delete actions on all categories (including defaults)
- Warning if category has transactions before deletion

---

#### 5. Multi-Currency Support

**Features:**
- ✅ Set main currency (user setting)
- ✅ Add currencies user uses
- ✅ Manual exchange rate entry (MVP)
- ✅ Display transactions in original currency
- ✅ Display reports in main currency

**Business Rules:**
- User has ONE main currency
- Each transaction stores: `amount_original`, `currency_original`, `exchange_rate`, `amount_home`
- `amount_home = amount_original * exchange_rate`
- If `currency_original == main_currency`, then `exchange_rate = 1.0`
- Exchange rates entered manually (auto-fetch in v1.1)

**UI Requirements:**
- Currency selector in transaction form
- Exchange rate input (only if currency ≠ account currency)
- Visual indicator for multi-currency transactions
- Conversion preview: "$100 USD = S/375 PEN"

---

#### 6. Insights & Reports

**Features:**
- ✅ Category Pivot Table: Show last 3 months of spending by category in a table format.
- Categories as rows
- Last 3 complete months as columns
- Total column on right
- Total row on bottom
- Positive values in green
- Negative values in red
- Values in main currency
- Responsive/scrollable on mobile
- Tap row → filter transactions by category
- Export to CSV option


---

#### 7. Data Export

**Features:**
- ✅ Export to CSV (all tables)
- ✅ Export to JSON (complete backup)
- ✅ Download as ZIP
- ✅ Include README with format documentation

**Business Rules:**
- Export ALL user data
- Include related data (accounts, transactions, categories, currencies)
- CSV format: one file per table
- JSON format: single file with nested structure

**Files Generated:**
- `accounts.csv`
- `transactions.csv`
- `categories.csv`
- `currencies.csv`
- `data.json` (complete backup)
- `README.txt` (format documentation)

**UI Requirements:**
- "Export Data" button in settings
- Progress indicator while generating
- Automatic download when ready

---

#### 8. Settings

**Features:**
- ✅ Theme selection (Light / Dark / System)
- ✅ Main currency selection
- ✅ Start of week (for date grouping)
- ✅ Profile management
- ✅ Password change
- ✅ Delete account

**UI Requirements:**
- Settings organized into sections
- Visual feedback for changes
- Confirmation for destructive actions

---

### Future Features (Post-MVP)

#### v1.1 (Month 2)
- Automatic exchange rate fetching (API integration)
- Recurring transactions
- Budget tracking per category
- Widgets (spending summary, quick add)
- CSV import

#### v1.2 (Month 3)
- Receipt photo uploads
- Advanced filtering
- Transaction tags
- Split transactions
- API for third-party integrations (read-only)

#### v2.0 (Months 4-6)
- Todo app integration (task → transaction)
- Shared accounts (family/roommates)
- Bank integration (read-only sync)
- AI categorization
- Advanced insights & predictions

---

## Development Standards

### Code Style

#### TypeScript

```typescript
// ✅ GOOD: Explicit types
interface Account {
  id: string;
  name: string;
  balance: number;
}

function getAccount(id: string): Promise<Account> {
  // ...
}

// ❌ BAD: Any types
function getAccount(id: any): any {
  // ...
}
```

#### React Components

```typescript
// ✅ GOOD: Functional components with TypeScript
interface AccountCardProps {
  account: Account;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function AccountCard({ account, onEdit, onDelete }: AccountCardProps) {
  return (
    <Card>
      <h3>{account.name}</h3>
      <p>{formatCurrency(account.balance)}</p>
    </Card>
  );
}

// ❌ BAD: Class components, no types
export class AccountCard extends React.Component {
  render() {
    return <div>{this.props.account.name}</div>;
  }
}
```

#### API Functions

```typescript
// ✅ GOOD: Centralized, typed, error handling
export const accountsApi = {
  getAll: async (): Promise<Account[]> => {
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*');
    
    if (error) throw error;
    return data;
  },
};

// ❌ BAD: Inline queries, no error handling
const { data } = await supabase.from('bank_accounts').select('*');
setAccounts(data);
```

---

### Naming Conventions

```typescript
// Files
account-card.tsx          // Components: kebab-case
use-accounts.ts           // Hooks: use-*
account-helpers.ts        // Utils: kebab-case
account.types.ts          // Types: *.types.ts
account.schema.ts         // Schemas: *.schema.ts

// Variables
const accountBalance = 1000;          // camelCase
const EXCHANGE_RATE_API = 'url';      // SCREAMING_SNAKE_CASE (constants)

// Types/Interfaces
interface Account {}                   // PascalCase
type AccountInput = {};               // PascalCase

// Components
function AccountCard() {}             // PascalCase

// Functions
function calculateBalance() {}        // camelCase

// Database
bank_accounts                         // snake_case (tables)
user_id                               // snake_case (columns)
```

---

### Validation

#### Use Zod for all inputs

```typescript
import { z } from 'zod';

// Define schema
export const accountSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(50, 'Name too long'),
  starting_balance: z.number()
    .min(0, 'Balance cannot be negative'),
  currency: z.string()
    .length(3, 'Invalid currency code'),
});

// Use in forms
const form = useForm({
  resolver: zodResolver(accountSchema),
});

// Use in API
const result = accountSchema.safeParse(data);
if (!result.success) {
  throw new Error(result.error.message);
}
```

---

### Error Handling

```typescript
// ✅ GOOD: Comprehensive error handling
try {
  const account = await accountsApi.create(data);
  toast.success('Account created successfully');
  return account;
} catch (error) {
  if (error instanceof PostgrestError) {
    // Database error
    if (error.code === '23505') {
      toast.error('Account name already exists');
    } else {
      toast.error('Database error. Please try again.');
    }
  } else if (error instanceof Error) {
    // Other errors
    toast.error(error.message);
  } else {
    // Unknown error
    toast.error('Something went wrong');
  }
  
  // Log for debugging
  console.error('Error creating account:', error);
  
  // Re-throw if needed
  throw error;
}

// ❌ BAD: Silent failures
try {
  await accountsApi.create(data);
} catch (error) {
  // Nothing happens
}
```

---

### Performance

#### Use React Query for server state

```typescript
// ✅ GOOD: React Query with proper configuration
export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.getAll,
    staleTime: 5 * 60 * 1000,      // 5 minutes
    cacheTime: 10 * 60 * 1000,     // 10 minutes
    refetchOnWindowFocus: false,
  });
}

// ❌ BAD: Manual state management
const [accounts, setAccounts] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  async function fetchAccounts() {
    setLoading(true);
    const data = await accountsApi.getAll();
    setAccounts(data);
    setLoading(false);
  }
  fetchAccounts();
}, []);
```

#### Optimize queries

```typescript
// ✅ GOOD: Select only needed fields
const { data } = await supabase
  .from('transactions')
  .select('id, amount_home, date, category:categories(name)')
  .limit(50);

// ❌ BAD: Select everything
const { data } = await supabase
  .from('transactions')
  .select('*');
```

---

### Security

#### Never trust client input

```typescript
// ✅ GOOD: Validate before using
const schema = z.object({
  amount: z.number().positive().max(999999999),
  description: z.string().max(500),
});

const result = schema.safeParse(formData);
if (!result.success) {
  return { error: 'Invalid input' };
}

const validated = result.data;
// Use validated data
```

#### Use RLS, don't filter in client

```typescript
// ✅ GOOD: RLS handles filtering
const { data } = await supabase
  .from('bank_accounts')
  .select('*');
// Returns only current user's accounts (RLS)

// ❌ BAD: Manual filtering
const { data } = await supabase
  .from('bank_accounts')
  .select('*')
  .eq('user_id', userId);  // Don't do this! RLS handles it
```

#### Sanitize user input

```typescript
import DOMPurify from 'isomorphic-dompurify';

// ✅ GOOD: Sanitize before storing
const sanitized = DOMPurify.sanitize(userInput.trim());

// ❌ BAD: Store raw user input
const description = userInput; // Could contain XSS
```

---

## API Guidelines

### Structure

All API functions in `features/[feature]/api/`:

```typescript
// features/accounts/api/accounts.ts
export const accountsApi = {
  getAll: async () => {},
  getById: async (id: string) => {},
  create: async (data: NewAccount) => {},
  update: async (id: string, data: Partial<Account>) => {},
  delete: async (id: string) => {},
};
```

### Error Handling

```typescript
export const accountsApi = {
  create: async (account: NewAccount): Promise<Account> => {
    const { data, error } = await supabase
      .from('bank_accounts')
      .insert(account)
      .select()
      .single();

    if (error) {
      // Log for debugging
      console.error('Error creating account:', error);
      
      // Throw with context
      throw new Error(`Failed to create account: ${error.message}`);
    }

    return data;
  },
};
```

### React Query Integration

```typescript
// features/accounts/hooks/use-create-account.ts
export function useCreateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: accountsApi.create,
    onSuccess: (newAccount) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      
      // Or optimistic update
      queryClient.setQueryData(['accounts'], (old: Account[]) => 
        [...old, newAccount]
      );
      
      // Show success message
      toast.success('Account created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create account');
      console.error(error);
    },
  });
}
```

---

## Security Requirements

### Row Level Security (RLS)

**Critical:** All tables MUST have RLS enabled and policies defined.

```sql
-- Enable RLS
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

-- Create policies for all operations
CREATE POLICY "policy_name" ON table_name
  FOR operation
  USING (condition)
  WITH CHECK (condition);
```

### Authentication

- Use Supabase Auth (no custom auth)
- Store sessions securely (httpOnly cookies)
- Implement password strength requirements
- Add rate limiting to auth endpoints (future)

### Data Validation

- Validate all inputs with Zod
- Sanitize user input (DOMPurify)
- Use parameterized queries (Supabase handles this)
- Implement CSRF protection (Next.js handles this)

### Secrets Management

```bash
# .env.local (NEVER commit)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...

# .env.example (commit this)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## Testing Strategy

### Unit Tests

```typescript
// lib/utils/currency.test.ts
import { describe, it, expect } from 'vitest';
import { formatCurrency } from './currency';

describe('formatCurrency', () => {
  it('formats USD correctly', () => {
    expect(formatCurrency(1234.56, 'USD')).toBe('$1,234.56');
  });

  it('formats PEN correctly', () => {
    expect(formatCurrency(1234.56, 'PEN')).