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

Inside each domain folder (e.g., `features/transactions/`), we encapsulate logic to keep the global namespace clean. The transactions feature uses a **Repository Pattern** (see section 6 below) with this layered structure:

```
features/transactions/
├── domain/           # Platform-agnostic entities, types, constants, errors
│   ├── entities.ts   # Core domain entities (TransactionEntity, TransactionViewEntity)
│   ├── types.ts      # DTOs, DataResult pattern, value objects
│   ├── constants.ts  # Validation rules shared with iOS
│   ├── errors.ts     # Domain-specific error classes
│   └── index.ts      # Public exports
├── repository/       # Data Access Layer (Infrastructure isolation)
│   ├── transaction-repository.interface.ts  # Platform-agnostic contract
│   ├── supabase-transaction-repository.ts   # Supabase implementation
│   └── index.ts      # Factory function (DI)
├── services/         # Business Logic Layer
│   ├── transaction-service.interface.ts     # Service contract
│   ├── transaction-service.ts               # Business logic (retry, auth, UUID generation)
│   └── index.ts      # Factory function (DI)
├── hooks/            # React Query hooks (UI integration)
│   ├── use-transaction-service.ts           # Service initialization
│   ├── use-transactions.ts                  # React Query hooks using service
│   └── ...other hooks
├── components/       # Domain-specific UI (TransactionForm, TransactionList)
├── api/              # [DEPRECATED] Old direct API calls (being phased out)
└── schemas/          # Zod validation schemas
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

## 6. Repository Pattern Architecture (Transactions Feature)

### Overview

The transactions feature implements a **Repository Pattern with Todoist-style offline-first architecture** to support dual-platform development (Web TypeScript + iOS Swift/SwiftUI). This pattern creates platform-agnostic contracts that prevent "Logic Drift" between platforms.

**Status:** ✅ **IMPLEMENTED** (Days 0-8 Complete, Component Migration Pending)

### Strategic Vision

This architecture enables **Todoist-style offline sync** capabilities:
- **Current State (Phase 1):** Repository Pattern with platform-agnostic contracts + soft deletes
- **Future State (Phase 2):** Full offline sync with local cache (IndexedDB/SQLite) and delta sync API

### Core CTO Mandates (All Implemented)

#### 1. Atomic Transfer Protocol
**Problem:** Network interruption between two `create()` calls leaves ledger unbalanced.
**Solution:** Single atomic RPC (`create_transfer_transaction`) creates both OUT and IN transactions.
**Impact:** iOS app can never encounter orphaned half-transfers.

#### 2. Version-Based Sync (NOT Timestamps)
**Problem:** Clock drift causes missed deletions/updates during sync.
**Solution:** Global monotonic version counter (`global_transaction_version` sequence).
**Impact:** Sync works even if device clock is wrong - deterministic and gap-proof.

#### 3. Sacred Integer Arithmetic
**Problem:** Floating-point math causes balance drift (`0.1 + 0.2 !== 0.3`).
**Solution:** Domain entities use integer cents only - conversion at service boundary.
**Impact:** TypeScript and Swift produce identical balance calculations - zero drift.

#### 4. Soft Deletes (Tombstone Pattern)
**Problem:** Hard deletes break offline sync - iOS can't detect deletions.
**Solution:** Set `deleted_at = NOW()` instead of physical DELETE.
**Impact:** Enables delta sync with tombstone reconciliation.

#### 5. DataResult Pattern (Swift-Compatible)
**Problem:** TypeScript's `try/catch` is too loose - iOS needs explicit contracts.
**Solution:** `DataResult<T>` wrapper with success/failure/conflict states.
**Impact:** iOS can mirror with Swift's `Result<T, Error>` type.

#### 6. Auth Provider Abstraction
**Problem:** Service layer calling `supabase.auth.getUser()` won't work with iOS Native Apple Auth.
**Solution:** `IAuthProvider` interface with platform-specific implementations.
**Impact:** iOS can use Native Apple Sign-In while Web uses Supabase Auth.

#### 7. Strict ISO 8601 Enforcement
**Problem:** JavaScript's `new Date()` is forgiving - Swift's `ISO8601DateFormatter` crashes on malformed dates.
**Solution:** Repository validates `YYYY-MM-DDTHH:mm:ss.SSSZ` format with regex.
**Impact:** Cross-platform date handling never fails.

#### 8. Shared Validation Constants
**Problem:** Zod validation rules are TypeScript-only - iOS needs same constraints.
**Solution:** Extract validation rules into `constants.ts` file.
**Impact:** Both platforms enforce identical business rules.

#### 9. Real Dependency Injection
**Problem:** Singleton factory functions make testing impossible.
**Solution:** Factory functions accept dependencies as parameters.
**Impact:** Can inject mock repositories/services for testing.

### Architectural Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  UI Components (React/SwiftUI)                                  │
│  - Transaction forms, lists, filters                            │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│  React Query Hooks (Web) / Combine Subscribers (iOS)            │
│  - useTransactions(), useAddTransaction(), etc.                 │
│  - Optimistic updates for zero-latency UX                       │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│  Service Layer (ITransactionService)                            │
│  - Business logic (UUID generation, retry on conflict)          │
│  - Auth context extraction (via IAuthProvider)                  │
│  - Platform-agnostic (TypeScript/Swift implementations)         │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│  Repository Layer (ITransactionRepository)                      │
│  - Data access contract (platform-agnostic interface)           │
│  - Supabase implementation (Web) / iOS implementation (future)  │
│  - DECIMAL ↔ INTEGER CENTS conversion at boundary               │
│  - DataResult<T> pattern for explicit error handling            │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│  Database (PostgreSQL via Supabase)                             │
│  - Soft deletes (deleted_at column)                             │
│  - Version-based sync (global_transaction_version sequence)     │
│  - Atomic transfer RPC (create_transfer_transaction)            │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow Example (Creating Transaction)

**Web (TypeScript):**
```typescript
// 1. UI Component
<TransactionForm onSubmit={handleSubmit} />

// 2. React Query Hook
const { mutate } = useAddTransaction();
mutate({ accountId: '...', amountCents: 1050, date: '...' });

// 3. Service Layer (business logic)
class TransactionService {
  async create(data: CreateTransactionDTO): Promise<TransactionViewEntity> {
    const userId = await this.authProvider.getCurrentUserId(); // Auth abstraction
    const transactionId = crypto.randomUUID(); // Client-side UUID

    const result = await this.repository.create(userId, transactionId, data);
    if (!result.success) throw result.error; // DataResult pattern
    return result.data;
  }
}

// 4. Repository Layer (data access)
class SupabaseTransactionRepository {
  async create(userId, transactionId, data): Promise<DataResult<TransactionViewEntity>> {
    // Convert INTEGER CENTS → DECIMAL for database
    const { error } = await supabase.from('transactions').insert({
      id: transactionId,
      user_id: userId,
      amount_original: this.fromCents(data.amountCents), // 1050 → 10.50
      ...
    });

    if (error) return { success: false, data: null, error: new RepositoryError(error.message) };
    return this.getById(userId, transactionId); // Write-then-Read
  }
}

// 5. Database
-- INSERT with trigger updating global_transaction_version sequence
```

**iOS (Swift - Future Implementation):**
```swift
// 1. UI Component
TransactionFormView(onSubmit: viewModel.handleSubmit)

// 2. Combine Publisher / Async-Await
let transaction = try await viewModel.createTransaction(data)

// 3. Service Layer (business logic)
class TransactionService {
    func create(data: CreateTransactionDTO) async throws -> TransactionViewEntity {
        let userId = try await authProvider.getCurrentUserId() // Native Apple Auth
        let transactionId = UUID().uuidString // Client-side UUID

        let result = try await repository.create(userId: userId, transactionId: transactionId, data: data)
        if !result.success { throw result.error } // DataResult pattern
        return result.data
    }
}

// 4. Repository Layer (data access)
class SupabaseTransactionRepository {
    func create(userId: String, transactionId: String, data: CreateTransactionDTO) async -> Result<TransactionViewEntity, Error> {
        // Convert INTEGER CENTS → DECIMAL for database
        let response = try await supabase.from("transactions").insert([
            "id": transactionId,
            "user_id": userId,
            "amount_original": fromCents(data.amountCents), // 1050 → 10.50
            ...
        ])

        guard response.error == nil else {
            return .failure(RepositoryError(response.error.message))
        }
        return try await getById(userId: userId, id: transactionId) // Write-then-Read
    }
}

// 5. Database (same PostgreSQL instance)
```

### Key Benefits

1. **Platform Independence:** iOS team can implement Swift protocols without web knowledge
2. **Logic Parity:** Both platforms execute identical business logic (retry, auth, validation)
3. **Testability:** Mock repositories/services for unit testing
4. **Offline Readiness:** Soft deletes + version-based sync prepare for Phase 2
5. **Type Safety:** DataResult pattern prevents silent error swallowing
6. **Balance Integrity:** Integer cents prevent floating-point drift across platforms

### Migration Status

**✅ Completed (Days 0-8):**
- Database migration (soft deletes, version sequence, atomic transfer RPC)
- Domain layer (entities with integer cents, types, constants, errors)
- Repository layer (interface + Supabase implementation with DataResult pattern)
- Service layer (business logic with retry on conflict)
- Hook layer (React Query hooks using service)
- Auth provider abstraction (IAuthProvider + Supabase implementation)

**⏳ Pending (Days 9-11):**
- Component type migration (`TransactionView` → `TransactionViewEntity`)
- Hook file renaming (`use-transactions-new.ts` → `use-transactions.ts`)
- Deprecate old API (`features/transactions/api/transactions.ts`)
- Full regression testing
- Update DB_SCHEMA.md documentation

### Critical Rules for Using Repository Pattern

**DO:**
- ✅ Use hooks that call service layer (`useAddTransaction`, `useUpdateTransaction`)
- ✅ Use domain entities (`TransactionViewEntity`, `TransactionEntity`)
- ✅ Use DTOs for input (`CreateTransactionDTO`, `UpdateTransactionDTO`)
- ✅ Handle `DataResult<T>` explicitly (check `success` field before accessing `data`)
- ✅ Use integer cents in domain entities (`amountCents: 1050` for $10.50)
- ✅ Inject dependencies via factory functions (for testing)

**DON'T:**
- ❌ Call `supabase.from('transactions')` directly from components/hooks
- ❌ Use old `transactionsApi` functions (deprecated, will be removed)
- ❌ Use old types like `TransactionView` (use `TransactionViewEntity` instead)
- ❌ Use decimal amounts in domain layer (always use integer cents)
- ❌ Throw errors from repository methods (return `DataResult<T>` instead)
- ❌ Skip version field in update operations (required for optimistic concurrency)
- ❌ Hard delete transactions (use soft delete via `service.delete()`)

For detailed implementation examples and iOS integration guide, see [AI_CONTEXT.md](./AI_CONTEXT.md) section 4H.
