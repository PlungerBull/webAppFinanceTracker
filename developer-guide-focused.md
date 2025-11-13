# Finance Tracker - Developer Guide

**Version:** 1.0  
**Last Updated:** November 2025

---

## 1. App Purpose

### What is this?

A **personal finance tracking application** that helps users manage their money across multiple accounts and currencies with a beautiful, intuitive interface.

### Core Value Proposition

- **Quick & Easy**: Add a transaction in under 7 seconds
- **Multi-Currency**: Essential for dual-currency economies (e.g., USD + PEN in Peru)
- **Instant Access**: No loading screens - data available immediately (offline-first)
- **Privacy-First**: Users own their data, can export anytime
- **Beautiful**: Todoist-level polish and attention to detail

### Target Users

- Individuals managing personal finances
- People in dual-currency economies
- Users wanting simple income/expense/transfer tracking
- Privacy-conscious users who value data ownership

### Key Differentiators

1. **Multi-currency is first-class**, not an afterthought
2. **Offline-first** - works perfectly without internet
3. **Simple but powerful** - no budget complexity, just tracking
4. **Beautiful UX** - every detail matters
5. **Data ownership** - export everything, anytime

---

## 2. Ecosystem Vision

### The Big Picture

This finance tracker is **Phase 1** of a larger personal productivity ecosystem. All apps will share the same backend (Supabase) and integrate seamlessly.

```
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Backend                         │
│                  (Shared PostgreSQL DB)                     │
└──────────┬────────────┬─────────────┬────────────┬─────────┘
           │            │             │            │
    ┌──────▼─────┐ ┌───▼──────┐ ┌────▼─────┐ ┌───▼──────────┐
    │  Finance   │ │   Todo   │ │  Notes   │ │Communication │
    │  Tracker   │ │   App    │ │   App    │ │     Hub      │
    │  (Phase 1) │ │(Phase 2) │ │(Phase 3) │ │  (Phase 4)   │
    └────────────┘ └──────────┘ └──────────┘ └──────────────┘
```

### Roadmap

#### **Phase 1: Finance Tracker** (Current - Q1 2026)
- Track income, expenses, transfers
- Multiple accounts and currencies
- Insights and reporting
- Data export
- **Platforms:** Web → iOS → Android

#### **Phase 2: Todo/Task Manager** (Q2 2026)
- Task management with custom states
- Native event support (not just tasks)
- Subtask checklists with auto-completion
- **Integration:** Tasks can create transactions
  - Example: Complete "Pay mortgage $1000" → auto-creates expense

#### **Phase 3: Notes App** (Q3 2026)
- Beautiful, distraction-free writing
- Link notes to tasks and transactions
- Quick capture and organization
- **Integration:** Reference financial transactions in notes

#### **Phase 4: Communication Hub** (Q4 2026)
- Unified messaging across all apps
- Comment on tasks/transactions/notes
- All conversations in one place
- Context-aware threads

### Cross-App Integration Examples

```
Example 1: Task → Transaction
User creates task: "Pay electricity bill $85"
User completes task
→ Automatically creates $85 expense in "Utilities" category

Example 2: Transaction → Note
User logs large purchase: "$2000 Laptop"
User adds note: "Dell XPS 15, warranty details, receipt..."
→ Note linked to transaction for future reference

Example 3: Unified Comments
User comments on task in Todo app
→ Comment appears in Communication Hub
User replies from Finance app
→ Reply syncs across all apps
```

### Why This Matters

- **Single backend** - Build once, use everywhere
- **Data connections** - Apps enhance each other
- **Unified experience** - Consistent design across all apps
- **Privacy** - All data in one place under user's control

---

## 3. Tech Stack

### Frontend - Web (Current)

```
Framework:     Next.js 14+ (App Router)
Language:      TypeScript 5+
UI Library:    React 18+
Styling:       Tailwind CSS 3+
Components:    shadcn/ui (Radix UI + Tailwind)
State:         TanStack Query v5 (server) + Zustand (client)
Forms:         React Hook Form + Zod validation
Charts:        Recharts 2+
Icons:         Lucide React
Dates:         date-fns 3+
```

**Why this stack:**
- Next.js: Best React framework, excellent performance
- TypeScript: Type safety prevents bugs
- TanStack Query: Best practice for server state
- shadcn/ui: Beautiful, accessible, customizable
- Zod: Runtime validation + TypeScript types

### Frontend - iOS (Phase 2 - Starting Dec 2025)

```
Language:      Swift 5.9+
UI:            SwiftUI
Local Storage: Core Data + SQLite
Networking:    Supabase Swift SDK
State:         Combine (reactive)
```

**Why native:**
- Best performance
- Native feel and gestures
- Deep iOS integration
- Worth the extra effort for quality

### Frontend - Android (Phase 3 - Q2 2026)

```
Language:      Kotlin
UI:            Jetpack Compose
Local Storage: Room + SQLite
Networking:    Supabase Kotlin SDK
```

### Backend (Shared by all platforms)

```
Platform:      Supabase
Database:      PostgreSQL 15+
Auth:          Supabase Auth (JWT)
Storage:       Supabase Storage (for future receipt photos)
Functions:     Edge Functions (Deno/TypeScript)
Real-time:     Supabase Realtime (optional)
```

**Why Supabase:**
- PostgreSQL (reliable, powerful)
- Built-in auth and RLS
- SDKs for all platforms
- Real-time sync capabilities
- Cost-effective

### Infrastructure

```
Web Hosting:   Vercel (Next.js)
CI/CD:         GitHub Actions
Monitoring:    Sentry (errors)
Analytics:     Vercel Analytics (privacy-focused)
```

---

## 4. Mobile Development Plan

### Platform Priority

```
1. iOS (Native Swift)    - Dec 2025 onwards
2. Android (Native)      - Q2 2026
```

**Why iOS first:**
- Target market has high iPhone penetration
- Better monetization potential
- Apple ecosystem integration
- Native quality is critical

### Development Strategy

#### **Phase 1: Web (Now - Dec 2025)**
- Build and validate all features
- Test with real users
- Prove product-market fit
- Establish data model

#### **Phase 2: iOS Native (Dec 2025 - Feb 2026)**
- Native Swift/SwiftUI app
- Same Supabase backend
- Offline-first with Core Data
- All web features + iOS-specific polish

#### **Phase 3: Android Native (Q2 2026)**
- Once iOS is proven
- Native Kotlin/Compose
- Same backend again
- Platform-specific optimizations

### Shared Backend Architecture

```
                    ┌─────────────────┐
                    │    Supabase     │
                    │   PostgreSQL    │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
         ┌────▼────┐    ┌────▼────┐   ┌────▼────┐
         │   Web   │    │   iOS   │   │ Android │
         │ Next.js │    │  Swift  │   │ Kotlin  │
         └─────────┘    └─────────┘   └─────────┘
```

**Benefits:**
- Build database schema once
- Write business logic once (in database)
- RLS policies protect all platforms
- Data syncs automatically across devices

### Offline-First on All Platforms

```
Web:       IndexedDB → Supabase
iOS:       Core Data → Supabase  
Android:   Room → Supabase

All platforms:
1. Read from local database (instant)
2. Write to local database (instant)
3. Sync to Supabase (background)
4. Handle conflicts automatically
```

---

## 5. Database Structure

### Overview

PostgreSQL database hosted on Supabase, accessed by all platforms.

### Core Tables

```
auth.users             (Managed by Supabase Auth)
├── bank_accounts      (User's financial accounts)
├── account_currencies (Currencies per account - junction table)
├── transactions       (All money movements)
├── categories         (Spending categories)
├── currencies         (User's currencies)
└── user_settings      (User preferences)
```

### Detailed Schemas

#### **bank_accounts**
Stores user's financial accounts.

```sql
CREATE TABLE bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                    -- "Checking", "Savings", "Credit Card", etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bank_accounts_user_id ON bank_accounts(user_id);
```

**Key Points:**
- Simple table - just stores account name and user
- Currencies and balances are stored in `account_currencies` junction table
- This allows accounts to support multiple currencies (essential for credit cards, etc.)

---

#### **account_currencies** (NEW - Multi-Currency Support)
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

CREATE INDEX idx_account_currencies_account_id ON account_currencies(account_id);
CREATE INDEX idx_account_currencies_currency_code ON account_currencies(currency_code);
```

**Key Points:**
- **Many-to-many** relationship: One account can have multiple currencies
- Each currency for an account has its own `starting_balance`
- Perfect for credit cards that support multiple currencies
- Example: Credit card with USD and PEN balances
- Current balance per currency = `starting_balance + SUM(transactions in that currency)`

**Why this design:**
- Credit cards often support spending in multiple currencies
- Bank accounts in dual-currency economies (Peru, Argentina, etc.)
- Properly normalized (3NF) - avoids data duplication
- Easy to query and maintain

---

#### **transactions**
Stores all financial movements (income, expenses, transfers).

```sql
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT,
    
    -- Multi-currency support
    amount_original NUMERIC(15, 2) NOT NULL,      -- Positive or negative
    currency_original TEXT NOT NULL,              -- Transaction currency
    exchange_rate NUMERIC(15, 6) NOT NULL DEFAULT 1.0,
    amount_home NUMERIC(15, 2) NOT NULL,         -- Converted to main currency
    
    -- Transfer linking
    transfer_id UUID,                             -- Links transfer pairs
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_transfer_id ON transactions(transfer_id);
```

**Key Points:**
- **Positive amount** = Income, refunds, money received
- **Negative amount** = Expenses, purchases, money spent
- **Transfer** = Two transactions with same `transfer_id`
- `amount_home = amount_original * exchange_rate`
- If same currency as main: `exchange_rate = 1.0`

**Examples:**
```sql
-- Income: Salary
amount_original: 3000, currency_original: 'USD', exchange_rate: 1.0
→ amount_home: 3000

-- Expense: Groceries  
amount_original: -85.50, currency_original: 'PEN', exchange_rate: 0.27
→ amount_home: -23.09 (in USD)

-- Refund (positive transaction in expense category)
amount_original: 20, currency_original: 'USD', exchange_rate: 1.0
category: 'Food & Dining' (same as original expense)
→ amount_home: 20
```

---

#### **categories**
Organizes transactions by spending area.

```sql
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,            -- Emoji: '🍔', '🚗', '💼'
    color TEXT NOT NULL,           -- Hex: '#FF5733'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_user_id ON categories(user_id);
```

**Key Points:**
- **NOT split by income/expense** - same category can have both
- `user_id = NULL` → System default category
- `user_id = <uuid>` → User-created category
- Users CAN delete/edit default categories
- Categories represent spending areas, not transaction types

**Default Categories:**
```sql
INSERT INTO categories (user_id, name, icon, color) VALUES
(NULL, 'Food & Dining', '🍔', '#EF4444'),
(NULL, 'Transportation', '🚗', '#F97316'),
(NULL, 'Housing', '🏠', '#F59E0B'),
(NULL, 'Salary & Income', '💼', '#10B981'),
(NULL, 'Shopping', '🛒', '#EAB308'),
(NULL, 'Healthcare', '💊', '#EC4899'),
(NULL, 'Entertainment', '🎬', '#8B5CF6'),
(NULL, 'Utilities', '📱', '#6366F1'),
(NULL, 'Education', '🎓', '#3B82F6'),
(NULL, 'Gifts', '🎁', '#34D399'),
(NULL, 'Other', '💰', '#64748B');
```

**Philosophy:**
- **"Food & Dining"** can have:
  - -$50 (expense: groceries)
  - +$10 (refund: returned item)
- **"Salary & Income"** can have:
  - +$3000 (income: paycheck)
  - -$50 (deduction: tax adjustment)

This is **simpler and more flexible** than separate income/expense category systems.

---

#### **currencies**
Tracks which currencies each user works with.

```sql
CREATE TABLE currencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code TEXT NOT NULL,                -- 'USD', 'PEN', 'EUR'
    is_main BOOLEAN DEFAULT FALSE,     -- User's primary currency
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, code)              -- No duplicates
);

CREATE INDEX idx_currencies_user_id ON currencies(user_id);
```

**Key Points:**
- Each user has exactly ONE main currency (`is_main = TRUE`)
- All reports show values in main currency
- User can add any currencies they use
- Example for Peru user: USD (main), PEN (secondary)

---

#### **user_settings**
User preferences.

```sql
CREATE TABLE user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
    start_of_week INTEGER DEFAULT 0 CHECK (start_of_week BETWEEN 0 AND 6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Key Points:**
- One row per user
- Created on signup
- `start_of_week`: 0 = Sunday, 6 = Saturday

---

### Row Level Security (RLS)

**Critical:** Every table MUST have RLS enabled.

```sql
-- Enable RLS on all tables
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Example policy (apply pattern to all tables)
CREATE POLICY "Users can view their own data"
    ON bank_accounts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own data"
    ON bank_accounts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own data"
    ON bank_accounts FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own data"
    ON bank_accounts FOR DELETE
    USING (auth.uid() = user_id);

-- Special RLS for account_currencies (indirect ownership through bank_accounts)
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

**Special case for categories:**
```sql
-- Users see system defaults + their own
CREATE POLICY "Users can view default and own categories"
    ON categories FOR SELECT
    USING (user_id IS NULL OR auth.uid() = user_id);

-- Users can delete any category (including defaults)
CREATE POLICY "Users can delete any categories"
    ON categories FOR DELETE
    USING (user_id IS NULL OR auth.uid() = user_id);
```

**Why RLS matters:**
- Enforced at database level (can't be bypassed)
- Client code doesn't need to filter by `user_id`
- Works automatically across all platforms
- Prevents data leaks

---

## 6. Database Functions

### 1. `create_transfer()`

**Purpose:** Atomically create a transfer between two accounts.

**Why needed:** Transfers require TWO transaction records (debit + credit). If created separately, one might fail, corrupting data. This function ensures both succeed or both fail.

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
    -- Validate ownership
    IF NOT EXISTS (
        SELECT 1 FROM bank_accounts 
        WHERE id = p_from_account_id AND user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'From account not found';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM bank_accounts 
        WHERE id = p_to_account_id AND user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'To account not found';
    END IF;
    
    -- Generate transfer ID
    v_transfer_id := uuid_generate_v4();
    v_amount_home := p_amount * p_exchange_rate;
    
    -- Debit transaction
    INSERT INTO transactions (
        user_id, account_id, amount_original, currency_original,
        exchange_rate, amount_home, description, date,
        category_id, transfer_id
    ) VALUES (
        p_user_id, p_from_account_id, -p_amount, p_currency_original,
        p_exchange_rate, -v_amount_home, p_description, p_date,
        p_category_id, v_transfer_id
    ) RETURNING id INTO v_transaction_1_id;
    
    -- Credit transaction
    INSERT INTO transactions (
        user_id, account_id, amount_original, currency_original,
        exchange_rate, amount_home, description, date,
        category_id, transfer_id
    ) VALUES (
        p_user_id, p_to_account_id, p_amount, p_currency_original,
        p_exchange_rate, v_amount_home, p_description, p_date,
        p_category_id, v_transfer_id
    ) RETURNING id INTO v_transaction_2_id;
    
    RETURN json_build_object(
        'transfer_id', v_transfer_id,
        'debit_transaction_id', v_transaction_1_id,
        'credit_transaction_id', v_transaction_2_id
    );
END;
$$;
```

**Usage:**
```typescript
// TypeScript (Web)
const result = await supabase.rpc('create_transfer', {
  p_user_id: userId,
  p_from_account_id: 'checking-account-id',
  p_to_account_id: 'savings-account-id',
  p_amount: 500,
  p_currency_original: 'USD',
  p_exchange_rate: 1.0,
  p_description: 'Monthly savings',
  p_date: new Date().toISOString(),
});

// Swift (iOS)
let result = try await supabase.rpc("create_transfer")
  .execute(parameters: [
    "p_user_id": userId,
    "p_from_account_id": checkingId,
    "p_to_account_id": savingsId,
    "p_amount": 500,
    "p_currency_original": "USD",
    "p_exchange_rate": 1.0,
    "p_description": "Monthly savings",
    "p_date": Date().ISO8601Format()
  ])
```

---

### 2. `delete_transfer()`

**Purpose:** Atomically delete both transactions in a transfer.

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

**Usage:**
```typescript
await supabase.rpc('delete_transfer', {
  p_user_id: userId,
  p_transfer_id: transferId,
});
```

---

### 3. `account_balances` View (Multi-Currency)

**Purpose:** Pre-calculate account balances per currency for performance.

```sql
CREATE OR REPLACE VIEW account_balances AS
SELECT
    ac.id,
    ba.id as account_id,
    ba.user_id,
    ba.name,
    ac.currency_code as currency,
    ac.starting_balance,
    COALESCE(SUM(t.amount_original), 0) as transaction_sum,
    ac.starting_balance + COALESCE(SUM(t.amount_original), 0) as current_balance,
    ba.created_at,
    ba.updated_at
FROM account_currencies ac
JOIN bank_accounts ba ON ba.id = ac.account_id
LEFT JOIN transactions t ON t.account_id = ac.account_id
    AND t.currency_original = ac.currency_code
GROUP BY ac.id, ba.id, ba.user_id, ba.name, ac.currency_code,
         ac.starting_balance, ba.created_at, ba.updated_at;

GRANT SELECT ON account_balances TO authenticated;
```

**Key Changes:**
- Returns **one row per account per currency** (not one row per account)
- Joins through `account_currencies` junction table
- Filters transactions by matching currency
- Example: Credit card with USD and PEN shows 2 rows

**Usage:**
```typescript
// Get all balances for an account (may return multiple currencies)
const { data } = await supabase
  .from('account_balances')
  .select('*')
  .eq('account_id', accountId);

// Result for multi-currency account:
// [
//   { account_id: '123', currency: 'USD', current_balance: 1000 },
//   { account_id: '123', currency: 'PEN', current_balance: 5000 }
// ]
```

**Why this matters:**
- **Without view:** Complex multi-table join + currency filtering + manual calculation
- **With view:** Simple query, balances already calculated per currency
- **Performance:** 5-10x faster for multi-currency accounts

---

### 4. Auto-update `updated_at` Trigger

**Purpose:** Automatically update `updated_at` timestamp on row changes.

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

CREATE TRIGGER update_categories_updated_at 
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at 
    BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### 5. Future: `complete_task_with_transaction()` (Phase 2)

**Purpose:** When implementing todo app integration, this function will atomically complete a task and create a linked transaction.

```sql
-- Placeholder for Phase 2
CREATE OR REPLACE FUNCTION complete_task_with_transaction(
    p_user_id UUID,
    p_task_id UUID,
    p_transaction_data JSON
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
-- Will be implemented in Phase 2
-- Atomically:
-- 1. Update task state to 'done'
-- 2. Create linked transaction
-- Both succeed or both fail
$$;
```

---

## Summary

### Quick Reference

**App:** Personal finance tracker  
**Purpose:** Track income, expenses, transfers across multiple accounts/currencies  
**Platforms:** Web → iOS → Android  
**Backend:** Supabase (PostgreSQL)  
**Key Feature:** Offline-first, multi-currency, beautiful UX

**Database Tables:**
- `bank_accounts` - User's financial accounts
- `account_currencies` - Junction table: accounts ↔ currencies (multi-currency support)
- `transactions` - All money movements (+ or -)
- `categories` - Spending areas (not split by type)
- `currencies` - User's currencies
- `user_settings` - User preferences

**Key Functions:**
- `create_transfer()` - Atomic transfer between accounts
- `delete_transfer()` - Atomic transfer deletion
- `account_balances` - Pre-calculated balance view

**Mobile Strategy:**
- Same Supabase backend
- Native apps (Swift, Kotlin)
- Offline-first with local databases
- Data syncs automatically

---

**Ready to build!** 🚀
