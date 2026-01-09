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

* **Server State:** Managed by TanStack Query. We aggressively cache read data and use optimistic updates for mutations (like deleting a transaction) to make the UI feel instant.
* **Infinite Scroll:** Transaction and inbox lists use virtualized pagination for performance.
    * Uses `useInfiniteQuery` with 50-item pages and offset-based pagination
    * Virtual scrolling renders only ~15 visible items (via `@tanstack/react-virtual`)
    * Server-side aggregation for filter counts (prevents inaccurate client-side counting)
* **Client State:** Minimal. We prefer URL state (search params) for filters and modals to ensure shareability and deep-linking. Global UI state (like sidebar toggle) may live in `stores/`.

### 4. Database-Driven Logic

Crucial business rules are enforced at the database level using PostgreSQL constraints and triggers.

* **Example:** A trigger prevents a Transaction from having a different currency than its parent Account.
* **Example:** Account balances are updated via triggers (`update_account_balance`), ensuring that even raw SQL inserts update the balance correctly.

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
