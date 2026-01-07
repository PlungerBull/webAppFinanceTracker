# AI ARCHITECTURE CONTEXT

## 📜 Document Governance

**Purpose**: The "Mental Model" for the codebase. High-level architecture, directory structure, and coding standards.

**Include**: Tech stack, folder organization, abstract architectural patterns (e.g., Sacred Ledger), and "Do/Don't" rules.

**Do NOT Include**: SQL definitions, table schemas, migration logs, specific file line numbers, or UI pixel measurements.

**Maintenance**: Update only when a global architectural pattern or a major tech-stack component changes.

---

## 1. Project Overview
**Name:** Finance Tracker Web
**Description:** A personal finance application for tracking income, expenses, and budgeting.
**Core Philosophy:** Strict separation between "Database Types" (snake_case) and "Domain Types" (camelCase). The frontend should never see raw database rows.

## 2. Tech Stack & Rendering Strategy
* **Framework:** Next.js 16 (App Router)
* **Rendering Strategy:** Client-Side Heavy (SPA-like architecture)
    * **CRITICAL:** This is NOT a traditional Next.js SSR app
    * All data fetching uses **Supabase Client SDK** from browser
    * Components are primarily Client Components (`"use client"`)
    * **DO NOT** suggest Server Actions or Server Components for data mutations
    * **DO NOT** suggest moving API logic to `app/api/` routes
    * Think of this as a React SPA hosted on Next.js infrastructure
* **Language:** TypeScript (Strict mode)
* **Database & Auth:** Supabase (PostgreSQL)
* **State Management (Server):** TanStack Query (React Query) v5
* **State Management (Client):** Zustand
* **Styling:** Tailwind CSS + Radix UI Primitives + Lucide Icons
* **Forms:** React Hook Form + Zod validation
* **Date Handling:** date-fns

## 3. Directory Structure (Feature-Based)
We use a **Feature-Based Architecture**. Do not group files by type; group them by feature.

```text
/app                 -> Next.js App Router (Pages & Layouts only)
/components          -> Shared UI components (Buttons, Modals, etc.)
  /ui                -> Shadcn/Radix primitive wrappers
  /shared            -> Reusable composite patterns (FormModal, DeleteDialog) - USE THESE FIRST.
/lib                 -> Global utilities & configurations
  /supabase          -> Supabase clients (Client & Server)
  /constants         -> App-wide constants (validation, ui, etc.)
/features            -> DOMAIN LOGIC (The core of the app)
  /accounts          -> Bank accounts & balance management
  /auth              -> Authentication & User Profile
  /categories        -> Expense/Income categories management
  /currencies        -> Global currency data & logic
  /dashboard         -> Overview & financial summary widgets
  /groupings         -> Custom groupings for categories
  /import-export     -> CSV/Data migration services
  /inbox             -> Staging area for draft transactions & processing logic
  /settings          -> User preferences (Theme, Main Currency)
  /shared            -> Shared UI components used across features
    /components
      /transaction-detail-panel -> Unified detail panel for Inbox + Transactions
  /transactions      -> Transaction creation, listing, and transfers
/types               -> Global type definitions
  database.types.ts  -> Raw Supabase types (Generated)
  domain.ts          -> Frontend interfaces (CamelCase)
/hooks               -> Shared/Global hooks (e.g., use-formatted-balance.ts)
/stores              -> Global Client State (Zustand stores, e.g., auth-store.ts)
/providers           -> React Context Providers (QueryProvider, AuthProvider)
/contexts            -> React Context definitions (State logic)
```

## 4. Architectural Rules (Strict Enforced)

### A. Currency Architecture (Flat Model)
* **One Currency Per Account:** Each `bank_accounts` row has exactly ONE `currency_code` that cannot be changed after creation.
* **Multi-Currency Accounts:** To support multiple currencies for the same "account concept," use the `group_id` pattern:
    * Create separate account rows for each currency (e.g., "Savings (USD)", "Savings (EUR)")
    * Link them with the same `group_id`
    * Use `create_account_group` RPC to create grouped accounts
* **No Junction Tables:** All currency logic lives on the `bank_accounts` table directly.
* **Opening Balances:** Created as transactions with `category_id = NULL` AND `transfer_id = NULL`, using the description "Opening Balance".
    * Users should set opening balances during account creation.
* **Currency Changes:** To change an account's currency, users must create a new account. The Edit Account modal only allows editing name and color, displaying currency as read-only.
* **Currency Inheritance (Normalized Architecture):**
    * **CRITICAL:** Currency is NOT an editable field in transaction forms, inbox detail panel, or transaction detail panels
    * Currency is **derived** from the selected bank account (one currency per account)
    * **Zero Redundancy Pattern:**
        * `transactions` table has NO `currency_original` column
        * `transaction_inbox` table has NO `currency_original` column
        * Currency is ALWAYS derived from `bank_accounts.currency_code` via JOIN
        * Query `transactions_view` or `transaction_inbox_view` to access currency (exposed as `currency_original` alias)
        * This makes currency desync **structurally impossible** (no redundant storage)
    * **Frontend Contract:** Code MUST NOT send `currency_original` - it doesn't exist in either table
    * **Data Flow:**
        * Transactions: `transactions.account_id → bank_accounts.currency_code`
        * Inbox: `transaction_inbox.account_id → bank_accounts.currency_code` (LEFT JOIN)
        * When `account_id` is NULL (inbox draft without account), `currency_original` is NULL
        * `promote_inbox_item` RPC requires `account_id` before promotion (hard-gate validation)
    * When user changes the account selection, the currency automatically updates to match the new account's currency
    * UI should display currency as read-only text, never as an input or selector
    * This applies to: Transaction forms, Inbox detail panel, Transaction detail panel, and all editing interfaces
* **Account Display Convention (UI Naming Pattern):**
    * **CRITICAL:** All account selectors MUST follow the format: `${Name} ${Code}`
    * **ALWAYS use `currencyCode`** (e.g., "USD", "EUR", "PEN") - NEVER use `currencySymbol` (e.g., "$", "€", "S/")
    * **Example:** "BCP Credito PEN" ✅ NOT "BCP Credito S/" ❌
    * **Type Safety:** `SelectableAccount` interfaces must include `currencyCode: string` as a required field
* **Account Name Normalization:**
    * **Rule:** Account names are stored clean in the database (no currency code suffixes)
    * **Database State:** Names like `"BCP Credito"` with `currency_code = "PEN"` (single source of truth)
    * **Uniqueness:** Database enforces `UNIQUE (user_id, name, currency_code)` to prevent duplicates
    * **DO NOT:** Add frontend code that strips currency codes from names - database is already clean!
    * **DO:** Use `account.name` directly from database without any transformation

### A2. Category Architecture ("Invisible Grouping" Pattern)
* **Strict Hierarchy, Flat UI:** Categories follow a two-level parent-child hierarchy in the database, but the UI presents only leaf nodes.
* **Groupings are Configuration, Not Destinations:**
    * Parent categories (groupings) define organizational structure, type (income/expense), and color
    * Users can ONLY select child categories (leaf nodes)
    * Parent categories are never displayed as selectable options in the UI
    * Exception: Orphaned parents (parents with no children) are treated as leaf nodes
* **Type Inheritance (Database-Enforced):**
    * Database triggers ensure children automatically inherit the parent's `type` field
    * Trigger: `sync_category_type_hierarchy` cascades type changes from parent to children
* **Color Inheritance (Database-Enforced):**
    * Triggers: `cascade_color_to_children` and `sync_child_category_color` ensure children inherit parent colors
* **Transaction Type Auto-Derivation:**
    * Users do NOT manually select transaction type (Income/Expense)
    * Transaction type is automatically derived from the selected category's type
    * The `derivedType` field in forms is computed via `useEffect` when `categoryId` changes
    * Visual feedback: Amount displays in green (income) or red (expense) based on derived type
* **Category Selector UI:**
    * Flat single-level list (no section headers)
    * Color indicators are the primary visual differentiator
    * No parent context shown (clean, minimal design)
    * Sorted: Income categories first, then Expense, then alphabetically
    * Hook: `useLeafCategories()` filters and returns only selectable categories
* **Implementation:**
    * **CRITICAL:** All category selectors MUST use `useLeafCategories()` - NEVER `useCategories()` directly for user selection
    * **Pattern:** Filter at the data source (hook level), not in the UI component (transformation level)

### B. Data Transformation Strategy (CRITICAL)

#### B1. Core Transformation Pattern
* **Never return raw DB rows to components.**
* **API Layer Responsibility:** Fetch data from Supabase → Transform snake_case to camelCase → Return Domain Type.
* **Transformer Pattern:** Use helper functions in `@/lib/types/data-transformers`.
    * *Bad:* `return data` (frontend receives `user_id`)
    * *Good:* `return dbTransactionToDomain(data)` (frontend receives `userId`)

#### B2. Table vs View Transformers
* **Table Transformers:** For raw table rows (e.g., `dbTransactionToDomain`, `dbInboxItemToDomain`)
    * Sets `currencyOriginal: undefined` because currency column doesn't exist in tables
    * Use ONLY for internal operations, never for UI display
* **View Transformers:** For database views (e.g., `dbTransactionViewToDomain`, `dbInboxItemViewToDomain`)
    * Includes `currencyOriginal` from view's aliased JOIN (`bank_accounts.currency_code AS currency_original`)
    * Includes joined display fields (account name, category name, colors)
    * Use for ALL UI operations and frontend display
* **Critical Rule:** Mutations must never trust raw table data - always re-fetch from views

#### B3. Write-then-Read Pattern (Mutation Architecture)
* **Rule:** Mutations must use "Write-then-Read" pattern to prevent incomplete data in React Query cache.
* **Pattern:**
    ```typescript
    // ✅ CORRECT: Write to table, then read from view
    const { data } = await supabase.from('transactions').insert({...}).select().single();
    return transactionsApi.getById(data.id); // Returns complete view data with currency
    ```
* **Applied To:** All mutation operations (`create`, `update`, `updateBatch`)

#### B4. Null/Undefined Normalization
* **The Problem:** Database uses `null` for missing values, but TypeScript optional properties use `undefined`. Mixing both creates type confusion.
* **The Solution:** Centralized bidirectional conversion in the data transformer layer:
    * **Database → Domain:** `dbInboxItemToDomain()` converts `null → undefined` for all optional fields
    * **Domain → Database:** `domainInboxItemToDbInsert()` converts `undefined → null` for database storage
* **Domain Types Use Optional Properties:**
    * **Good:** `interface InboxItem { amount?: number }` (single type: `number | undefined`)
    * **Bad:** `interface InboxItem { amount: number | null }` (dual types: confusing!)
    * **Exception:** Update params use explicit null unions (`amount?: number | null`) to differentiate "not provided" (undefined) vs "clear value" (null)
* **Benefits:**
    * Components only see `undefined`, never `null`
    * Single source of truth for conversion logic
    * Type safety without dual null/undefined checks
* **Implementation:**
    * Transformer: `lib/types/data-transformers.ts`
    * Domain Types: `features/inbox/types.ts`, `features/shared/components/transaction-detail-panel/types.ts`
    * API Layer: Uses transformer for all database operations

### C. State Management
* **Server State:** Use `useQuery` / `useMutation` hooks located in `features/[feature]/hooks/`.
* **Pagination:** All list queries use `useInfiniteQuery` with offset-based pagination.
    * **Page Size:** 50 items per page (configured in `PAGINATION.DEFAULT_PAGE_SIZE`)
    * **Virtualization:** Lists render only visible items (~15) using `@tanstack/react-virtual`
    * **Pattern:** API returns `{ data, count }`, hooks flatten pages internally for UI consumption
    * **Server-Side Aggregation:** Category counts use separate lightweight queries (not client-side counting)
* **Invalidation:** Mutations must invalidate relevant query keys upon success.
    * *Example:* Creating a transaction must invalidate `['transactions']` AND `['accounts']` (since balances change).
* **Division of Labor:**
    * **Server State (Async):** MUST use TanStack Query (e.g., transactions, balances).
    * **Client State (Sync):** Use Zustand (e.g., user session, sidebar state, complex form wizards).

### D. API Layer Pattern
* **All Supabase logic** belongs in `features/[feature]/api/[feature].ts`.
* **Do not** call `supabase.from(...)` directly inside React components.
* **Do not** put business logic inside the API layer; keep it in Services or Hooks if complex.
* **Prefer RPC for Complex Logic:** Before writing complex transaction logic, check `database.types.ts` for existing Postgres functions.
    * *Example 1:* Use `rpc('create_transfer')` instead of manually inserting two transactions and updating balances.
    * *Example 2:* Use `rpc('promote_inbox_item')` to atomically validate and move drafts from Inbox to Ledger.
* **Execution Context:** The files in `features/*/api/*.ts` use the **Supabase Client SDK** (`@/lib/supabase/client`).
    * **DO NOT** create Next.js API Routes (`app/api/...`) or Server Actions unless strictly necessary (e.g., for webhooks).
    * **DO** call these API functions directly from your React Query hooks.

### E. Styling & UI Components
* Use `tailwind-merge` and `clsx` (via the `cn` helper) for dynamic classes.
* Prioritize Radix UI primitives for interactive elements (Dialogs, Popovers).
* **UI Component Hierarchy:**
    * **Before** using raw Radix primitives, check `@/components/shared` for pre-built patterns
    * **Always** use `FormModal` for data entry and `DeleteDialog` for confirmations
    * **Consistency:** Use established component patterns (Tag, Card, Badge) instead of custom implementations

### F. Data Entry Strategy (The "Scratchpad" Pattern)

```mermaid
flowchart LR
    User[User Input] -->|Partial Data| Inbox[(transaction_inbox)]
    User -->|Complete Data| Ledger[(transactions)]

    Inbox -->|Read via View| UI[UI Display]
    Ledger -->|Read via View| UI

    Inbox -->|promote_inbox_item RPC| Validation{Hard Gate}
    Validation -->|Missing Fields| Error[RAISE EXCEPTION]
    Validation -->|All Required Fields| Ledger

    style Inbox fill:#fef3c7
    style Ledger fill:#dcfce7
    style Validation fill:#dbeafe
    style Error fill:#fee2e2
```

* **The "Clean Ledger" Rule:** `transactions` table ONLY accepts complete data (Amount + Date + Account + Category).
* **The "Scratchpad Inbox" Rule:** `transaction_inbox` accepts PARTIAL data (nullable columns: `amount_original`, `description`, `notes`).
* **Smart Routing:**
    * **Complete Data** → Write to `transactions`
    * **Partial Data** → Write to `transaction_inbox`
* **Promotion Flow:**
    * Use `promote_inbox_item` RPC to move Inbox → Ledger
    * **Hard-Gate Validation:** RPC validates ALL required fields (`account_id`, `category_id`, `amount_original`, `description`, `date`)
    * **Audit Trail:** Promotion marks items as `status='processed'` and stores `inbox_id` in ledger
    * **Auto-Promotion:** Detail panel automatically promotes when all fields complete
* **Schema Parity:** Both tables use `amount_original`, support `notes` field, ledger includes `inbox_id` foreign key

### G. Transaction Detail Panel (Unified Component)
* **Path:** `features/shared/components/transaction-detail-panel/`
* **Modes:** Accepts `mode="inbox"` (Drafts) or `mode="transaction"` (Ledger)
* **Logic:**
    * **Smart Save:** Analyzes `calculateLedgerReadiness()` function
        * *Inbox Mode:* Allows "Save Draft" (Partial) or "Promote" (Complete via `promote_inbox_item` RPC)
        * *Transaction Mode:* Only allows "Keep Changes" if all required fields valid (Sacred Ledger Rule)
    * **Currency Display:** Uses fallback chain `selectedAccount?.currencyCode ?? data.currency` to prevent race conditions
    * **Cross-Currency:** If `selectedAccount.currencyCode !== mainCurrency`, Exchange Rate field becomes mandatory
* **Component Structure:**
    * **IdentityHeader:** Editable payee + amount with currency display
    * **FormSection:** Account, Category, Date, Exchange Rate (conditional), Notes
    * **MissingInfoBanner:** Dual-mode warnings (orange for inbox, red for ledger)
    * **ActionFooter:** Save/Promote buttons with validation
* **Data Requirements:** Must include IDs + display names (account_id + account_name, category_id + category_name), colors, metadata
* **Batch Save:** All edits staged in local state, explicit save via button, confirmation dialog on unsaved changes
* **CRITICAL:** Never create separate detail panels - always use shared component with mode prop

### H. Transaction List UI (Behavioral Design)
* **Card Layout:** Transactions displayed as cards with hover states
* **Structure:** Two-column layout (Identity | Amount)
* **Category Visualization:** Use the `Tag` component with category color inheritance
* **Selection State:** Visual feedback when transaction selected
* **Amount Display:** Monospaced font, color-coded by transaction type (income/expense)
* **Refer to Design System:** For specific spacing, typography, and color values, see component implementations

## 5. Coding Standards "Do's and Don'ts"
* **DO** use Zod schemas for all form inputs.
* **DO** use absolute imports (e.g., `@/components/...`) instead of relative imports (`../../`).
* **DO NOT** use `any`. Define an interface or use `unknown` if necessary.
* **DO NOT** hardcode magic strings (like table names or error messages); use constants from `@/lib/constants`.
* **Constants:** Import constants from the aggregator `@/lib/constants`, not specific sub-files.
    * *Good:* `import { TRANSACTIONS } from '@/lib/constants'`
* **UI Patterns:** Before using raw `Dialog` or `Modal` components, check `@/components/shared`.
    * *Rule:* Always use `FormModal` for data entry and `DeleteDialog` for confirmations.

## 6. Environment & Deployment Workflow (3-Tier Setup)

### A. The Three Environments
1.  **Local (The Lab):**
    * **Url:** `http://localhost:3000`
    * **Database:** Local Supabase Instance (Docker/CLI).
    * **Purpose:** Rapid prototyping, destroying/resetting DB, testing schema changes.
    * **Data Rule:** Fake/Seeded data only. Wiped frequently.

2.  **Development (The Staging Ground):**
    * **Url:** `finance-tracker-dev.vercel.app` (branch: `dev`)
    * **Database:** Supabase Cloud Project "FinanceTracker-DEV".
    * **Purpose:** Integration testing, verifying migrations before Prod, "User" testing.
    * **Data Rule:** Shared test data. Stable but expendable.

3.  **Production (The Real World):**
    * **Url:** `finance-tracker.vercel.app` (branch: `main`)
    * **Database:** Supabase Cloud Project "FinanceTracker-PROD".
    * **Purpose:** Live user usage.
    * **Data Rule:** SACRED. Real financial data. Backups required.

### B. The Flow of Change
* **Code Flow:** Local `feat/branch` → Merge to `dev` → Promote to `main`.
* **Schema Flow (Migrations):**
    * **NEVER** use the Supabase Dashboard Table Editor to change schema in Dev or Prod.
    * **ALWAYS** create migrations locally: `supabase db diff -f my_new_feature`.
    * **Apply** migrations automatically via CI/CD (GitHub Actions) when pushing to `dev` and `main`.

### C. Secrets Management
* **Local:** stored in `.env.local` (Gitignored).
* **Vercel Dev:** Environment Variables set to "Development" & "Preview" scopes.
* **Vercel Prod:** Environment Variables set to "Production" scope.

## 7. Global Data Management
* **Reset Account:** Use RPC `clear_user_data(p_user_id)`
    * **Deletes:** Transactions, Inbox, Accounts, Categories (CASCADE)
    * **Preserves:** User Settings (Theme, Currency) & Auth
    * **Security:** Enforces user identity match (Hard-Gate)
