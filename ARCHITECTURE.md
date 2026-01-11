# Architecture Overview

This document describes the high-level architecture and design patterns used in the WebApp Finance Tracker.

## Core Design Principles

### 1. Smart Import Strategy

We designed the import system so users don't have to start with a blank app. You can bring your existing data from personal Excel files. We process these files to ensure data quality while minimizing manual work.

**The Split:** Upon import, the system iterates through rows.

* **Complete Records:** If a row contains a valid Date, Amount, Payee, and can be confidentially linked to an existing Account and Category, it is inserted directly into the `transactions` table (Sacred Ledger).
* **Incomplete Records:** If data is missing (e.g., unknown category) or ambiguous, it is inserted into the `inbox` table.

**The Benefit:** Users don't have to manually "promote" every single coffee purchase if the system can recognize it, but they still get to review ambiguous large purchases.

### 2. Hybrid Feature-Based Architecture

We use a hybrid approach that combines Feature-Sliced Design for business logic with standard Next.js App Router conventions. This separates global shared utilities from domain-specific logic.

**Directory Structure:**

* `app/`: Contains the route definitions and page entry points (Next.js App Router).
* `features/`: Contains domain-specific business logic. Each folder here represents a distinct business domain.
* `components/`: Shared "dumb" UI components (e.g., Button, Modal, DataTable) that are agnostic to business logic (Design System).
* `hooks/`, `lib/`, `types/`: Shared utilities, global hooks, and types used across the application.
* `providers/` & `stores/`: Global state management and context providers.
* `supabase/`: Database definitions and client configuration.

**Existing Feature Domains:**

The `features/` directory is currently organized into these core domains:

* `accounts`: Logic for bank accounts, balances, and account settings.
* `categories`: Management of transaction categories and taxonomy.
* `transactions`: The core ledger logic, including creating, editing, and listing transactions.
* `reconciliations`: Bank statement reconciliation with selective field locking.
* `summary` (or similar): Logic for dashboards and financial overviews.
* `import` (if present): Logic for handling CSV/Excel file parsing and reconciliation.

**Feature Module Structure:**

Inside each domain folder (e.g., `features/transactions/`), we encapsulate logic to keep the global namespace clean. A typical feature folder contains:

```
features/transactions/
├── api/             # Supabase queries & mutations (useGetTransactions, useCreateTransaction)
├── components/      # Domain-specific UI (TransactionForm, TransactionList)
├── hooks/           # Complex logic hooks (useTransactionFilters)
└── types.ts         # shared interfaces for this domain
```

### 3. Server vs. Client State

* **Server State:** Managed by TanStack Query with Optimistic-Sync architecture for zero-latency UX.
* **Optimistic Updates (Zero-Latency UX):**
    * **Pattern:** Request-Response → Optimistic-Sync (instant UI updates, background sync)
    * **Implementation:** All transaction mutations use optimistic updates similar to Linear/Reflect
    * **Version Control:** Database-enforced optimistic concurrency prevents data loss from concurrent edits
    * **Conflict Resolution:** Silent auto-retry (max 2 attempts), user notification only after exhaustion
    * **Balance Calculations:** Client-side calculation using cents arithmetic (prevents floating-point errors)
    * **Client UUIDs:** Generate transaction IDs with `crypto.randomUUID()` for instant feedback
    * **Cache Strategy:** Update ALL filter views simultaneously via `setQueriesData()` predicate
* **Infinite Scroll:** Transaction and inbox lists use virtualized pagination for performance.
    * Uses `useInfiniteQuery` with 50-item pages and offset-based pagination
    * Virtual scrolling renders only ~15 visible items (via `@tanstack/react-virtual`)
    * Server-side aggregation for filter counts (prevents inaccurate client-side counting)
* **Client State:** Minimal. We prefer URL state (search params) for filters and modals to ensure shareability and deep-linking. Global UI state (like sidebar toggle) may live in `stores/`.

### 4. Database-Driven Logic

Crucial business rules are enforced at the database level using PostgreSQL constraints and triggers.

* **Example:** A trigger prevents a Transaction from having a different currency than its parent Account.
* **Example:** Account balances are updated via triggers (`update_account_balance`), ensuring that even raw SQL inserts update the balance correctly.

### 5. Page Layout Pattern for Authenticated Views

All authenticated pages (dashboard, transactions, inbox, reconciliations) follow a consistent layout pattern:

**Required Structure:**
```tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { YourPageComponent } from '@/features/your-feature/components/your-page-component';

export default async function YourPage() {
  // 1. Server-side auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 2. Wrap content in DashboardLayout
  return (
    <DashboardLayout>
      <YourPageComponent />
    </DashboardLayout>
  );
}
```

**What DashboardLayout Provides:**
- **SidebarProvider**: Context for sidebar state (collapsed/expanded)
- **Sidebar Component**: Left panel with navigation (Home, Inbox, Transactions, Reconciliations) and account list
- **Main Content Area**: Right panel (`flex-1 overflow-y-auto`) for page content

**Layout Anatomy:**
```
┌─────────────────────────────────────────────────┐
│  DashboardLayout (flex container)               │
│  ┌──────────┬───────────────────────────────┐  │
│  │          │                               │  │
│  │ Sidebar  │  Main Content Area            │  │
│  │ (fixed   │  (flex-1 overflow-y-auto)     │  │
│  │  width)  │                               │  │
│  │          │  Your page component renders  │  │
│  │          │  here with full context       │  │
│  │          │                               │  │
│  └──────────┴───────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**Why This Matters:**
- Ensures consistent navigation context across all authenticated views
- Users can always see their accounts and switch between features
- Maintains sidebar state (collapsed/expanded) across page navigation
- Provides visual consistency and predictable UX

## Data Flow (Import Example)

1. **User Action:** Uploads `bank_statement.xlsx`.
2. **Service:** `DataImportService` (in `features/import/` or `lib/`) parses the file.
3. **Processing:**
   * System checks for existing accounts matching the import.
   * System attempts to map payee strings to existing categories.
4. **Database Routing:**
   * **Match:** `INSERT INTO transactions ...`
   * **No Match:** `INSERT INTO inbox ...`
5. **UI Response:** React Query invalidates `['transactions']` and `['inbox']` keys.
