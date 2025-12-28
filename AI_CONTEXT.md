# AI ARCHITECTURE CONTEXT

## 📜 Document Governance

**Purpose**: The "Mental Model" for the codebase. High-level architecture, directory structure, and coding standards.

**Include**: Tech stack, folder organization, abstract architectural patterns (e.g., Sacred Ledger), and "Do/Don't" rules.

**Do NOT Include**: SQL definitions, table schemas, migration logs, or specific file line numbers.

**Maintenance**: Update only when a global architectural pattern or a major tech-stack component changes.

---

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
* **Currency Inheritance in Transactions (Sacred Ledger Architecture - 2025-12-27):**
    * **CRITICAL:** Currency is NOT an editable field in transaction forms or detail panels
    * Currency is **derived** from the selected bank account (one currency per account)
    * **Database-Enforced:** The `enforce_sacred_ledger_currency` trigger automatically sets `currency_original` from `account.currency_code`
    * **Frontend Contract:** Code MUST NOT send `currency_original` - it's a system-managed field
    * **Implementation:**
        * Database: `currency_original` has DEFAULT 'PENDING', trigger overwrites it before INSERT completes
        * TypeScript: Field is optional in Insert type (generated from DEFAULT)
        * API Layer: Field is omitted from INSERT statements entirely
        * Trigger runs BEFORE INSERT, ensures `transactions.currency_original === bank_accounts.currency_code`
    * **Benefits:**
        * Impossible to create transactions with wrong currency (enforced at DB level)
        * No visual mismatches between list and detail panel views
        * Database is single source of truth
        * Zero technical debt (no type bypasses, no placeholder values)
    * When user changes the account selection, the currency automatically updates to match the new account's currency
    * UI should display currency as read-only text, never as an input or selector
    * This applies to: Transaction forms, Inbox detail panel, Transaction detail panel, and all editing interfaces
* **Account Display Convention (UI Naming Pattern):**
    * **CRITICAL:** All account selectors MUST follow the format: `${Name} ${Code}`
    * **ALWAYS use `currencyCode`** (e.g., "USD", "EUR", "PEN") - NEVER use `currencySymbol` (e.g., "$", "€", "S/")
    * **Rationale:** Currency symbols are ambiguous ($ = USD, CAD, AUD, etc.). Codes provide unambiguous identification.
    * **Enforcement Scope:** This applies to ALL account selection interfaces:
        * Add Transaction Modal (transaction-form.tsx) - SmartSelector component
        * Transaction Detail Panel (form-section.tsx) - Radix Select component
        * Account List Item (account-list-item.tsx) - Dashboard sidebar
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
    * Flat single-level list (no section headers like "INCOME" or "EXPENSE")
    * Color dots (3x3px) are the primary visual differentiator
    * No parent context shown (clean, minimal design)
    * Sorted: Income categories first, then Expense, then alphabetically
    * Hook: `useLeafCategories()` filters and returns only selectable categories
* **Implementation:**
    * **Add Transaction Modal:** Uses `CategorySelector` component with built-in `useLeafCategories()` filtering
    * **Transaction Detail Panel:** Parent component fetches leaf categories via `useLeafCategories()` and passes to detail panel
    * **Inbox Detail Panel:** Component fetches leaf categories directly via `useLeafCategories()` hook
    * **CRITICAL:** All category selectors MUST use `useLeafCategories()` - NEVER `useCategories()` directly for user selection
    * **Pattern:** Filter at the data source (hook level), not in the UI component (transformation level)

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

### F. Data Entry Strategy (The "Scratchpad" Pattern)
* **The "Clean Ledger" Rule:** The main `transactions` table must ONLY contain complete, valid data (Amount + Date + Account + Category).
* **The "Scratchpad Inbox" Rule:** The `transaction_inbox` table accepts PARTIAL data with relaxed constraints:
    * **Database Schema:** `amount` and `description` columns are NULLABLE
    * **Purpose:** Enable frictionless data entry - users can save ANY amount of information instantly
    * **Examples:** Just an amount, just a category, just a description - all valid inbox states
* **Smart Routing:** When building forms, check for data completeness:
    * **Complete Data (4 fields):** Amount + Description + Account + Category -> Write to Ledger (`transactions`)
    * **Partial Data (1-3 fields):** Any subset of fields -> Write to Inbox (`transaction_inbox`)
    * **Implementation:** Three-state validation (Empty → Partial → Complete) with single "Save" button
* **Promotion with Hard-Gate Validation (CRITICAL):**
    * Data moves from Inbox to Ledger via the `promote_inbox_item` RPC function
    * **Server-Side Hard-Gate:** RPC function explicitly validates ALL required fields before promotion:
        * `account_id IS NULL` → RAISE EXCEPTION 'Account ID is required'
        * `category_id IS NULL` → RAISE EXCEPTION 'Category ID is required'
        * `amount IS NULL` → RAISE EXCEPTION 'Amount is required'
        * `description IS NULL OR trim(description) = ''` → RAISE EXCEPTION 'Description is required'
        * `date IS NULL` → RAISE EXCEPTION 'Date is required'
    * **Audit Trail:** Promotion marks items as `status='processed'` instead of deleting them
    * **Frontend Cannot Bypass:** Database-level validation ensures ledger integrity regardless of frontend state
* **Auto-Promotion:** When editing inbox items in the detail panel, if all 4 required fields are complete, the item is automatically promoted to the ledger (with "vanishing effect")
* **Optimistic UI:** Promoted items disappear instantly from inbox list (onMutate), with robust rollback on error (onError restores snapshot)

### G. Data Normalization Pattern (Centralized Transformer)
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
    * Follows project architecture standards
* **Implementation:**
    * Transformer: `lib/types/data-transformers.ts`
    * Domain Types: `features/inbox/types.ts`, `features/shared/components/transaction-detail-panel/types.ts`
    * API Layer: `features/inbox/api/inbox.ts` uses transformer for all database operations

### H. Transaction Detail Panel Architecture (Unified Reconciliation Engine with Smart Save)
* **Shared Component Pattern:** Both Inbox and Transactions views use the SAME detail panel component located at `features/shared/components/transaction-detail-panel/`.
* **Smart Save System:** Intelligent button routing based on data completeness:
    * **Inbox Mode - Dual Callbacks:**
        * `onPartialSave`: Saves incomplete data as draft in inbox
        * `onPromote`: Validates completeness & promotes to ledger (atomic via `promote_inbox_item` RPC)
    * **Transaction Mode - Single Callback:**
        * `onSave`: Updates existing transaction (requires complete data - Sacred Ledger Rule)
    * **Readiness Calculation (Shared):**
        * Pure function `calculateLedgerReadiness()` validates: amount, description, account, category, date, exchange rate (cross-currency)
        * Returns `{ isReady, canSaveDraft, missingFields }` object
        * **CRITICAL:** Exchange rate required when `selectedAccount.currencyCode !== mainCurrency` (NOT `data.currency`)
    * **Button States:**
        * **Inbox Complete:** "Save to Ledger" (Blue) - promotes to ledger
        * **Inbox Incomplete:** "Save Draft" (Slate) - saves partial data
        * **Inbox Cross-Currency (no rate):** "Save Draft (Rate Required)" - warns about missing rate
        * **Transaction Complete + Changes:** "Keep Changes" (Slate-900) - saves updates
        * **Transaction Incomplete:** Button DISABLED - prevents corruption (Sacred Ledger Rule)
    * **Race Condition Protection:**
        * Uses `useUserSettings()` to detect if main currency still loading
        * Button disabled until `isSettingsReady = true`
        * Prevents saves with wrong currency assumption (default USD vs actual main currency)
* **Mode-Based Behavior:** The panel accepts a `mode` prop ('inbox' | 'transaction') that controls:
    * **Button Text:** Dynamic based on readiness (see Smart Save states above)
    * **Button Color:** Blue (ledger promotion), Slate (draft save), Slate-900 (transaction updates)
    * **Warning Banner:** Orange (inbox - draft-friendly) vs Red (transaction - data integrity enforcement)
    * **Amount Color:** Gray (inbox) vs Green/Red based on category type (transaction)
* **Component Structure:**
    * **IdentityHeader:** Editable payee (borderless input with "No description" placeholder) + editable amount (monospaced, dynamic color)
    * **FormSection:** Account, Category, Date, Exchange Rate (conditional), Notes fields with `space-y-4` spacing
        * **Account Selector:** Shows selected account name + currency symbol (e.g., "BCP Credito S/")
        * **Category Selector:** Shows selected category name with color dot
        * **Date Picker:** Calendar popover with formatted date display
        * **Exchange Rate Field (Reactive):** Only appears when selected account currency differs from user's main currency
            * **CRITICAL:** Comparison logic: `selectedAccount.currencyCode !== mainCurrency` (from user settings)
            * **NOT:** `data.currency` (which is temporary import metadata)
            * Shows "REQUIRED" badge in orange when visible
            * Orange border when empty to draw attention
            * Displays conversion helper: "1 {mainCurrency} = ? {accountCurrency}"
            * 4 decimal precision for accurate rates
            * Validation: Required for ledger promotion if currencies differ, optional for draft save
            * **Data Population:** Field populates from database via pattern: `editedFields.exchangeRate ?? data.exchangeRate ?? undefined`
            * Follows same pattern as other fields (account, category, notes)
        * **Notes Field:** Multiline textarea for transaction notes
    * **MissingInfoBanner (Dual-Mode):**
        * **Inbox Mode:** Orange warning (draft-friendly) - "Save as Draft" with helpful completion guidance
        * **Transaction Mode:** Red error (Sacred Ledger enforcement) - "Cannot Save Incomplete Transaction" with specific missing fields
        * Uses `getReadinessMessage()` helper for user-friendly field descriptions
    * **ActionFooter:** Pinned bottom buttons with Smart Save logic (see Button States above)
* **Data Requirements (CRITICAL):**
    * **transactions_view Database View:** Must include both IDs and display names:
        * IDs: `account_id`, `category_id` (required for editing)
        * Names: `account_name`, `category_name` (for display)
        * Colors: `account_color`, `category_color` (for UI indicators)
        * Metadata: `user_id`, `exchange_rate`, `notes`, `created_at`, `updated_at`
    * **Data Transformer:** `dbTransactionViewToDomain()` maps all fields from view to domain types
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

### I. Transaction List UI Design (Card-Based Layout)
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

## 7. Sacred Ledger Data Management

### Clear All Data Function (`clear_user_data`)

The `clear_user_data` RPC function implements the "Sacred Ledger" philosophy for secure, performant data resets.

#### Core Principles

**1. Identity Verification (Security)**
* Function verifies requesting user matches authenticated session
* Prevents unauthorized data wipes even if RPC endpoint is exposed
* Throws exception if user IDs don't match: `"Unauthorized: User can only clear their own data"`

**2. User Environment Preservation**
* **CRITICAL**: `user_settings` table is NEVER touched
* Theme preferences, main currency, week start day remain intact
* User returns to "Fresh Start" with familiar environment (no reconfiguration needed)

#### Frontend Usage

**Component**: `features/settings/components/data-management.tsx`

**Function Signature:**
```typescript
await supabase.rpc('clear_user_data', {
  p_user_id: user.id  // Must match authenticated session
});
```

**Success Flow:**
1. User clicks "Clear Data" button (confirmation dialog shown)
2. RPC function validates user identity (hard-gate check)
3. Sequential deletion executes (inbox → accounts → categories)
4. Success message displays: "All data cleared successfully. Starting fresh!"
5. React Query cache invalidated (transactions, accounts, categories)
6. Page refreshes to clean/onboarding state
7. User settings remain intact (theme, currency, preferences)

#### What Gets Deleted

* ✅ All transactions (via CASCADE when accounts deleted)
* ✅ All inbox items (staging area / scratchpad)
* ✅ All categories (user-created only, respects hierarchy)
* ✅ All bank accounts (triggers CASCADE deletion of transactions)

#### What Gets Preserved

* ✅ User settings (theme, main currency, week start)
* ✅ Authentication record (user can still log in)
* ✅ Global currencies table (shared reference data)

#### Related Documentation

* **DB Schema**: See `DB_SCHEMA.md` for function signature and technical details
* **Migration History**: See `CHANGELOG.md` for implementation details and problem/solution narrative