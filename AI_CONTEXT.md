# AI ARCHITECTURE CONTEXT

## 1. Project Overview
**Name:** Finance Tracker Web
**Description:** A personal finance application for tracking income, expenses, and budgeting.
**Core Philosophy:** Strict separation between "Database Types" (snake_case) and "Domain Types" (camelCase). The frontend should never see raw database rows.

## 2. Tech Stack
* **Framework:** Next.js 16 (App Router)
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
  /shared            -> [NEW] Shared UI components used across features
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
* **No Junction Tables:** The old `account_currencies` and `currencies` tables were removed. All currency logic is now on the `bank_accounts` table directly.
* **Opening Balances:** Created as transactions with `category_id = NULL` AND `transfer_id = NULL`, using the description "Opening Balance".
    * **UI Note:** Opening Balance option has been removed from the Add Transaction Modal (as of the Invisible Grouping refactor). Users should set opening balances during account creation.
* **Currency Changes:** To change an account's currency, users must create a new account. The Edit Account modal only allows editing name and color, displaying currency as read-only.
* **Currency Inheritance in Transactions:**
    * **CRITICAL:** Currency is NOT an editable field in transaction forms or detail panels
    * Currency is **derived** from the selected bank account (one currency per account)
    * When user changes the account selection, the currency automatically updates to match the new account's currency
    * UI should display currency as read-only text, never as an input or selector
    * This applies to: Transaction forms, Inbox detail panel, Transaction detail panel, and all editing interfaces
* **Account Display Convention (UI Naming Pattern):**
    * **CRITICAL:** All account selectors MUST follow the format: `${Name} ${Symbol}`
    * **ALWAYS use `currencySymbol`** (e.g., "$", "€", "S/") - NEVER use `currencyCode` (e.g., "USD", "EUR", "PEN")
    * **Rationale:** Symbol is the visual differentiator users recognize. Code is redundant and clutters the UI.
    * **Enforcement Scope:** This applies to ALL account selection interfaces:
        * Add Transaction Modal (transaction-form.tsx) - SmartSelector component
        * Transaction Detail Panel (form-section.tsx) - Radix Select component
        * Account List Item (account-list-item.tsx) - Dashboard sidebar
    * **Example:** "BCP Credito S/" ✅ NOT "BCP Credito (PEN)" ❌
    * **Type Safety:** `SelectableAccount` interfaces must include `currencySymbol: string` as a required field
* **Account Name Normalization (2025-12-27):**
    * **Database Migration:** Account names have been normalized to remove redundant currency code suffixes
    * **Before:** Database stored `"BCP Credito (PEN)"` + `currency_code = "PEN"` (redundant!)
    * **After:** Database stores `"BCP Credito"` + `currency_code = "PEN"` (single source of truth)
    * **Frontend Impact:** All name-cleaning logic has been REMOVED from hooks:
        * `use-flat-accounts.ts` - No longer generates `cleanName` field
        * `use-grouped-accounts.ts` - No longer uses `split(' (')[0]` pattern
        * Type `FlatAccount` is now simply `AccountBalance` (no extension needed)
    * **Migration Files:**
        * `20251227140411_fix_import_account_lookup.sql` - Fixed import logic to match by name + currency
        * `20251227140449_clean_account_names.sql` - Stripped currency suffixes from existing data
    * **Uniqueness Constraint:** Added `UNIQUE (user_id, name, currency_code)` to prevent duplicate accounts
    * **DO NOT:** Add frontend code that strips currency codes from names - database is clean!
    * **DO:** Use `account.name` directly from database without transformation

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
    * Flat single-level list (no section headers like "INCOME" or "EXPENSE")
    * Color dots (3x3px) are the primary visual differentiator
    * No parent context shown (clean, minimal design)
    * Sorted: Income categories first, then Expense, then alphabetically
    * Hook: `useLeafCategories()` filters and returns only selectable categories

### B. Data Flow & Transformation (CRITICAL)
* **Never return raw DB rows to components.**
* **API Layer Responsibility:** Fetch data from Supabase -> Transform snake_case to camelCase -> Return Domain Type.
* **Transformer Pattern:** Use `dbTransactionToDomain` or similar helpers in `@/lib/types/data-transformers`.
    * *Bad:* `return data` (frontend receives `user_id`)
    * *Good:* `return dbTransactionToDomain(data)` (frontend receives `userId`)

### C. State Management
* **Server State:** Use `useQuery` / `useMutation` hooks located in `features/[feature]/hooks/`.
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

### E. Styling & UI
* Use `tailwind-merge` and `clsx` (via the `cn` helper) for dynamic classes.
* Prioritize Radix UI primitives for interactive elements (Dialogs, Popovers).

### F. Data Entry Strategy (The "Staging" Pattern)
* **The "Clean Ledger" Rule:** The main `transactions` table must ONLY contain complete, valid data (Amount + Date + Account + Category).
* **The "Dirty Inbox" Rule:** Any incomplete data (e.g. Quick Adds with only Amount + Description) MUST be saved to `transaction_inbox`.
* **Smart Routing:** When building forms, check for data completeness.
    * *Complete Data* -> Write to Ledger (`transactions`).
    * *Incomplete Data* -> Write to Inbox (`transaction_inbox`).
* **Promotion:** Data moves from Inbox to Ledger via the `promote_inbox_item` RPC function, never via a direct `INSERT` + `DELETE` sequence.

### G. Transaction Detail Panel Architecture (Unified Reconciliation Engine)
* **Shared Component Pattern:** Both Inbox and Transactions views use the SAME detail panel component located at `features/shared/components/transaction-detail-panel/`.
* **Mode-Based Behavior:** The panel accepts a `mode` prop ('inbox' | 'transaction') that controls:
    * **Button Text:** "Promote to Ledger" (inbox) vs "Keep Changes" (transaction)
    * **Button Color:** Blue (inbox) vs Slate (transaction)
    * **Warning Banner:** Orange missing info banner shows only in inbox mode
    * **Amount Color:** Gray (inbox) vs Green/Red based on category type (transaction)
* **Component Structure:**
    * **IdentityHeader:** Editable payee (borderless input) + editable amount (monospaced, dynamic color)
    * **FormSection:** Account, Category, Date, Notes fields with `space-y-4` spacing
        * **Account Selector:** Shows selected account name + currency symbol (e.g., "BCP Credito S/")
        * **Category Selector:** Shows selected category name with color dot
        * **Date Picker:** Calendar popover with formatted date display
        * **Notes Field:** Multiline textarea for transaction notes
    * **MissingInfoBanner:** Conditional orange warning when required fields are missing (inbox only)
    * **ActionFooter:** Pinned bottom buttons (mode-specific)
* **Data Requirements (CRITICAL):**
    * **transactions_view Database View:** Must include both IDs and display names:
        * IDs: `account_id`, `category_id` (required for editing)
        * Names: `account_name`, `category_name` (for display)
        * Colors: `account_color`, `category_color` (for UI indicators)
        * Metadata: `user_id`, `exchange_rate`, `notes`, `created_at`, `updated_at`
    * **Data Transformer:** `dbTransactionViewToDomain()` maps all fields from view to domain types
    * **Fix Applied (Dec 2025):** Updated view to include missing fields, preventing "NULL" accountId/categoryId bug
* **Batch Save Pattern:**
    * All edits are staged in local state (`EditedFields` object)
    * NO auto-save on field change (prevents accidental edits)
    * Explicit save via "Keep Changes" / "Promote to Ledger" button
    * Confirmation dialog on close if unsaved changes exist
* **API Functions:**
    * Transactions: Use `transactionsApi.updateBatch()` to update multiple fields atomically
    * Inbox: Use `inboxApi.promote()` with final values (description, amount, date, account, category)
* **Layout Pattern:**
    * Both Inbox and Transactions use three-column layout: `Sidebar | TransactionList | DetailPanel`
    * Fixed 400px width for detail panel
    * Scrollable content area with pinned action footer
* **Design System:**
    * Typography: `text-[10px]` labels, `text-xl` payee, `text-3xl` amount
    * Spacing: `px-6 py-4` panel padding, `space-y-4` form sections
    * Colors: Orange (#f97316) for warnings, Blue (#2563eb) for inbox actions, Slate (#0f172a) for transaction actions
    * Form inputs: `bg-gray-50` default, `focus:bg-white`, `rounded-xl`
    * SelectValue Pattern: Must include children content to display selected value (not just placeholder)
* **IMPORTANT:** Never create separate detail panels for Inbox/Transactions. Always use the shared component with appropriate mode prop.

### H. Transaction List UI Design (Card-Based Layout)
* **Card Layout:** Each transaction is a white rounded card with subtle shadow on hover
* **Transaction Card Structure:**
    * **Left Column (Identity):**
        * Transaction description (semibold, 14px, truncated)
        * Category tag (10px uppercase, colored)
        * Date (10px, gray)
    * **Right Column (Amount):**
        * Amount value (18px, monospaced, green for income / black for expense)
        * Currency code (10px, gray)
* **Category Tag Styling (CURRENT DESIGN):**
    * **Background:** Category color at 12.5% opacity (`${categoryColor}20`)
    * **Text:** Full category color, bold/semibold for visibility
    * **Border:** Category color at 25% opacity (`${categoryColor}40`)
    * **NO vertical bar** on card edge
    * **NO color dot** next to category name
    * Visual example: Blue category = light blue background + **BLUE** bold text + blue-tinted border
* **Selection State:** Blue ring and border when selected (`ring-2 ring-blue-500/20 border-blue-200`)
* **Spacing:** `space-y-2` between cards, `px-4 py-3` card padding
* **Notes Indicator:** REMOVED (previously showed as small dot, now hidden)

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
* **Code Flow:** Local `feat/branch` -> Merge to `dev` -> Promote to `main`.
* **Schema Flow (Migrations):**
    * **NEVER** use the Supabase Dashboard Table Editor to change schema in Dev or Prod.
    * **ALWAYS** create migrations locally: `supabase db diff -f my_new_feature`.
    * **Apply** migrations automatically via CI/CD (GitHub Actions) when pushing to `dev` and `main`.

### C. Secrets Management
* **Local:** stored in `.env.local` (Gitignored).
* **Vercel Dev:** Environment Variables set to "Development" & "Preview" scopes.
* **Vercel Prod:** Environment Variables set to "Production" scope.