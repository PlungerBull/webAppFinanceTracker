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
* `lib/`: Shared utilities, including cross-feature hooks (`lib/hooks/`), and general-purpose modules.
* `lib/data/`: Runtime data layer — Zod validation schemas (`db-row-schemas.ts`), data transformers (`data-transformers.ts`, `local-data-transformers.ts`), and validation helpers (`validate.ts`).
* `types/`: Shared pure TypeScript types (interfaces, type aliases, database schema) — stripped at build time.
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

**Status:** ✅ **IMPLEMENTED** (All layers complete, type migration finalized)

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
**Status:** ✅ **COMPLETE** — All API/Service layers migrated. See [Section 10: Auth Provider Architecture](#10-auth-provider-architecture-iautprovider) for full details.

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

**✅ Complete:**
- Database migration (soft deletes, version sequence, atomic transfer RPC)
- Domain layer (entities with integer cents, types, constants, errors)
- Repository layer (interface + Supabase implementation with DataResult pattern)
- Service layer (business logic with retry on conflict)
- Hook layer (React Query hooks using service)
- Auth provider abstraction (IAuthProvider + SupabaseAuthProvider — **all** API/Service layers migrated)
- Component type migration (`TransactionViewEntity` used across all UI)
- Deprecated `TransactionView` interface and legacy transformer functions removed

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
- ❌ Use legacy types from `types/domain.ts` for transactions (use `TransactionViewEntity` from `features/transactions/domain`)
- ❌ Use decimal amounts in domain layer (always use integer cents)
- ❌ Throw errors from repository methods (return `DataResult<T>` instead)
- ❌ Skip version field in update operations (required for optimistic concurrency)
- ❌ Hard delete transactions (use soft delete via `service.delete()`)

For detailed implementation examples and iOS integration guide, see [AI_CONTEXT.md](./AI_CONTEXT.md) section 4H.

## 7. Transformer Registry (Data Border Control)

### Overview

All data entering the domain layer from Supabase passes through a centralized **Transformer Registry** in `lib/data/data-transformers.ts`. This file is the single source of truth for converting between database types (snake_case, nullable) and domain types (camelCase, strict).

### Why Centralized Transformers

In a distributed system (Web + iOS), divergent transformation logic causes **Dirty Data Drift** — where the local database state depends on which device last touched the record. Centralizing ensures:

- Schema changes update in one place (not per-repository)
- Null handling is consistent (`?? null` for optional, throw for critical)
- No "magic strings" leak into the data layer

### Transformer Categories

| Category | Responsibility | Pattern |
|---|---|---|
| **Raw Table Transformers** | Map 1:1 with DB tables | `dbAccountToDomain()`, `dbCategoryToDomain()`, `dbTransactionToDomain()` |
| **View Transformers** | Map SQL JOINs to enriched entities | `dbAccountViewToDomain()`, `dbInboxItemViewToDomain()` |
| **Insert/Update Transformers** | Domain → DB write format | `domainTransactionToDbInsert()`, `domainCategoryToDbUpdate()` |
| **Batch Transformers** | Array wrappers | `dbAccountViewsToDomain()` |

### Strict Integrity Rules

1. **Critical fields (`id`, `userId`) throw on null** — matches CTO mandate. If these are null, it's a data integrity failure that must be caught immediately, not masked.
2. **Optional fields use `?? null`** — never `|| ''` or `|| 'USD'`. Empty string is a valid value in a distributed system; null signals absence.
3. **Display defaults belong in UI components** — transformers return `null` for missing joined data (e.g., `accountName`). React components apply `?? 'Deleted Account'` at render time.
4. **Financial arithmetic uses `lib/utils/cents-conversion.ts`** — string-based parsing avoids IEEE 754 float errors (`1.15 * 100 !== 115`).

### Data Flow

```
Database (Supabase)
    │
    ▼
Shared Transformers (data-transformers.ts)    ← Single Source of Truth
    │   - Null normalization
    │   - BIGINT safety (bigint-safety.ts)
    │   - Float-safe cents (cents-conversion.ts)
    │   - Throw on critical null fields
    ▼
Domain Entities (feature/domain/entities.ts)
    │
    ▼
UI Components (React)                         ← Display Defaults Here
    - ?? 'Deleted Account'
    - ?? 'USD'
    - ?? ''
```

### Cross-Domain Transformers (Domain-to-Domain)

Some UI components need to display data from one domain as if it were another domain's shape. For example, `inbox-table.tsx` displays inbox items using the shared `TransactionList` component, which expects `TransactionViewEntity[]`.

Rather than duplicating the mapping logic inline, these "shape adapters" are centralized in `data-transformers.ts`:

| Transformer | Input | Output | Consumer |
|-------------|-------|--------|----------|
| `inboxItemViewToTransactionView()` | `InboxItemViewEntity` | `TransactionViewEntity` | `inbox-table.tsx` |
| `inboxItemViewsToTransactionViews()` | `InboxItemViewEntity[]` | `TransactionViewEntity[]` | Batch version |

**Key Mappings for Inbox → Transaction:**
- `accountColor`: `null` (not joined in inbox view)
- `categoryType`: `null` (inbox items don't have category type)
- `amountHomeCents`: uses `amountCents` (no currency conversion for inbox)
- `reconciliation` fields: `null`/`false` (inbox items aren't reconciled)
- `description`: falls back to `'—'` (em-dash) for UI display

**Usage:**
```typescript
// inbox-table.tsx
import { inboxItemViewsToTransactionViews } from '@/lib/data/data-transformers';

const transactions = inboxItemViewsToTransactionViews(inboxItems);
```

### Local Data Transformers (WatermelonDB Bridge)

**Status:** ✅ **IMPLEMENTED** — `lib/data/local-data-transformers.ts`

The remote transformers in `data-transformers.ts` accept **Supabase row shapes** (snake_case, from Postgres). The local repositories use **WatermelonDB models** (camelCase JS objects). To maintain the Single Interface Rule — both paths producing identical domain entity types — a dedicated bridge layer was created.

| Function | Input | Output (identical to remote) |
|---|---|---|
| `localAccountViewToDomain()` | `AccountModel` + `Map<string, CurrencyModel>` | `AccountViewEntity` |
| `localCategoryToDomain()` | `CategoryModel` | `CategoryEntity` |
| `localTransactionViewToDomain()` | `TransactionModel` + account/category maps | `TransactionViewEntity` |
| `localInboxItemViewToDomain()` | `InboxModel` + account/category/currency maps | `InboxItemViewEntity` |

Each local repository delegates its enrichment method to these shared transformers. The batch-fetching logic (No N+1 mandate) remains in the repository; the mapping logic lives in `local-data-transformers.ts`.

**Null handling is identical to remote transformers:**
- Missing joined data → `null` (never `'Unknown Account'` or `'USD'`)
- Missing optional fields → `null` (never `''`)
- `currencySymbol` → `null` when JOIN fails (not empty string)

### Rules for Repository Authors

**DO:**
- ✅ Import remote transformers from `@/lib/data/data-transformers` (for Supabase repositories)
- ✅ Import local transformers from `@/lib/data/local-data-transformers` (for WatermelonDB repositories)
- ✅ Use `toCents()` from `@/lib/utils/cents-conversion` for decimal→integer conversion
- ✅ Create specialized transformers (e.g., `toCategoryWithCountEntity`) that **call the shared base transformer internally** then spread additional fields

**DON'T:**
- ❌ Write inline transformation logic in repository files
- ❌ Use `|| ''` or `|| 'Unknown'` in transformers — return `null`
- ❌ Use `|| 'USD'` for missing currency — return `null`
- ❌ Duplicate null-handling logic that already exists in shared transformers

## 8. Performance & Optimization

### React Hook Form & Compiler Compatibility

- **Status:** Known Constraint.
- **Issue:** The use of `watch()` triggers a "Compilation Skipped" warning in the React Compiler. This occurs because `watch()` subscribes to form state changes in a way that the compiler cannot safely optimize.
- **Affected Components:** `add-category-modal.tsx`, `edit-grouping-modal.tsx`, and other form components using `watch()` for UI toggle logic.
- **Current Decision:** For Phase 3, this is acceptable technical debt. The `watch()` pattern is only used for lightweight UI toggles (showing/hiding fields, dynamic labels) and not for heavy data processing.
- **Mandate:** If performance bottlenecks are detected (especially on low-end mobile devices in Phase 4 Native), evaluate replacing `watch()` with:
  - `useFormContext` for nested component access
  - Manual `useState` for simple toggle state
  - `useWatch` hook for isolated subscriptions
- **Rule:** Never use `watch()` for expensive computations or heavy data transformations. Keep watched values isolated to UI presentation logic only.

## 9. Category Merge Protocol (Atomic Reassignment)

### Problem Statement

Merging categories is a **Ledger Event**. Simply running `UPDATE transactions SET category_id = ?` breaks offline-first synchronization because:
1. The `version` column on affected transactions won't change
2. iOS sync will miss these updates (no version bump = no detection)
3. Race conditions can orphan transactions mid-operation

### Solution: Atomic RPC with Version Bumping

All category merges MUST go through the `merge_categories` PostgreSQL function which:
1. Updates all affected transactions AND bumps their version
2. Deletes the source categories
3. Executes as a single atomic transaction

```sql
-- RPC: merge_categories(p_source_ids UUID[], p_target_id UUID)
-- 1. Update transactions and BUMP VERSION (mandatory for sync)
UPDATE transactions
SET
    category_id = p_target_id,
    version = version + 1,  -- 🚨 CRITICAL: Enables sync detection
    updated_at = NOW()
WHERE category_id = ANY(p_source_ids);

-- 2. Delete orphaned source categories
DELETE FROM categories
WHERE id = ANY(p_source_ids);
```

### Cache Invalidation Mandate

After a merge operation, BOTH query keys must be invalidated:
```typescript
await queryClient.invalidateQueries({ queryKey: ['categories'] });
await queryClient.invalidateQueries({ queryKey: ['transactions'] });
```

Failure to invalidate `transactions` will cause UI desync where old category names persist.

### Error Handling

The RPC returns structured errors for:
- **FK Violation:** Target category doesn't exist
- **Permission Denied:** User doesn't own all categories
- **Empty Source:** No source categories provided

All errors are mapped to typed domain errors (see ADR #002).

## 10. Auth Provider Architecture (Multi-Provider)

### Overview

All authentication is routed through a **multi-provider architecture** enabling platform-agnostic auth. This architecture supports:

1. **Identity Operations:** `IAuthProvider` for user identity (getUser, getSession, signOut) — all platforms
2. **Credential Operations:** `ICredentialAuthProvider` for email/password auth — web only
3. **OAuth Operations:** `IOAuthAuthProvider` for Apple/Google sign-in — iOS primarily
4. **ESLint Enforcement:** "Gatekeeper" rules block direct Supabase auth imports in features

**Status:** ✅ **COMPLETE** — Full multi-provider auth abstraction with DataResult pattern.

### Multi-Provider Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  UI Components (React/SwiftUI)                                   │
│  - Login, Signup, Settings pages                                 │
│  - Conditionally render based on available auth methods          │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│  Auth API (features/auth/api/auth.ts)                            │
│  createAuthApi(authProvider, credentialProvider?, oauthProvider?)│
│  - Identity ops → IAuthProvider                                  │
│  - Credential ops → ICredentialAuthProvider | null               │
│  - OAuth ops → IOAuthAuthProvider | null                         │
└─────────────────────┬───────────────────────────────────────────┘
                      │
    ┌─────────────────┼─────────────────┐
    │                 │                 │
┌───▼────┐     ┌──────▼──────┐    ┌─────▼─────┐
│IAuth   │     │ICredential  │    │IOAuth     │
│Provider│     │AuthProvider │    │AuthProvider│
│        │     │ (Web only)  │    │ (iOS only)│
└───┬────┘     └──────┬──────┘    └─────┬─────┘
    │                 │                 │
┌───▼────┐     ┌──────▼──────┐    ┌─────▼─────┐
│Supabase│     │Supabase     │    │Apple      │
│Auth    │     │Credential   │    │Auth       │
│Provider│     │Provider     │    │Provider   │
└────────┘     └─────────────┘    └───────────┘
```

**Platform Configuration:**
- **Web:** `IAuthProvider` + `ICredentialAuthProvider` (email/password)
- **iOS:** `IAuthProvider` + `IOAuthAuthProvider` (Apple Sign-In)

### Domain Types (Sacred Domain)

Platform-agnostic auth entities live in `domain/auth.ts` — any feature can import from here.

```typescript
// domain/auth.ts

// === User & Session Entities ===
interface AuthUserEntity {
  readonly id: string;
  readonly email: string | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly createdAt: string;
}

interface AuthSessionEntity {
  readonly accessToken: string;
  readonly refreshToken: string | null;
  readonly expiresAt: number;
  readonly user: AuthUserEntity;
}

// === Auth Event Types ===
type AuthEventType = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED';
type AuthStateChangeCallback = (event: AuthEventType, session: AuthSessionEntity | null) => void;
type AuthUnsubscribe = () => void;

// === Auth Method Types (Multi-Platform) ===
type AuthMethod = 'credential' | 'oauth_apple' | 'oauth_google';

// === Sign-In/Sign-Up Results ===
interface SignInResult {
  readonly user: AuthUserEntity;
  readonly session: AuthSessionEntity;
  readonly isNewUser: boolean;
}

interface SignUpResult {
  readonly user: AuthUserEntity | null;
  readonly session: AuthSessionEntity | null;
  readonly needsEmailConfirmation: boolean;
}

// === Credential Error Types ===
type CredentialErrorCode =
  | 'INVALID_CREDENTIALS' | 'EMAIL_NOT_CONFIRMED' | 'EMAIL_ALREADY_EXISTS'
  | 'WEAK_PASSWORD' | 'RATE_LIMITED' | 'REAUTHENTICATION_FAILED'
  | 'NETWORK_ERROR' | 'UNKNOWN_ERROR';

interface CredentialAuthError extends SerializableError {
  readonly code: CredentialErrorCode;
}

// === OAuth Error Types ===
type OAuthErrorCode = 'CANCELLED' | 'INVALID_TOKEN' | 'NOT_AVAILABLE' | 'NETWORK_ERROR' | 'UNKNOWN_ERROR';

interface OAuthAuthError extends SerializableError {
  readonly code: OAuthErrorCode;
}

// === OAuth Sign-In Data ===
interface OAuthSignInData {
  readonly identityToken: string;
  readonly nonce?: string;
  readonly firstName?: string;
  readonly lastName?: string;
}
```

```swift
// iOS Mirror
struct AuthUserEntity: Codable, Identifiable {
    let id: String
    let email: String?
    let firstName: String?
    let lastName: String?
    let createdAt: String
}

struct AuthSessionEntity: Codable {
    let accessToken: String
    let refreshToken: String?
    let expiresAt: Int
    let user: AuthUserEntity
}

enum AuthMethod: String, Codable {
    case credential
    case oauthApple = "oauth_apple"
    case oauthGoogle = "oauth_google"
}

struct SignInResult: Codable {
    let user: AuthUserEntity
    let session: AuthSessionEntity
    let isNewUser: Bool
}

enum CredentialErrorCode: String, Codable {
    case invalidCredentials = "INVALID_CREDENTIALS"
    case emailNotConfirmed = "EMAIL_NOT_CONFIRMED"
    // ...
}
```

### Interface Contracts

#### IAuthProvider (Identity Operations — All Platforms)

```typescript
// lib/auth/auth-provider.interface.ts
interface IAuthProvider {
  // === SERVICE LAYER METHODS (for constructor injection) ===
  getCurrentUserId(): Promise<string>;   // throws AuthenticationError
  isAuthenticated(): Promise<boolean>;
  signOut?(): Promise<void>;

  // === AUTH API METHODS (for IOC injection) ===
  getUser(): Promise<AuthUserEntity | null>;           // graceful null, never throws for missing session
  getSession(): Promise<AuthSessionEntity | null>;
  updateUserMetadata(metadata: Partial<{ firstName: string; lastName: string }>): Promise<void>;
  onAuthStateChange(callback: AuthStateChangeCallback): AuthUnsubscribe;
}
```

#### ICredentialAuthProvider (Email/Password — Web Only)

```typescript
// lib/auth/credential-auth-provider.interface.ts
interface ICredentialAuthProvider {
  signUp(data: CredentialSignUpData): Promise<DataResult<SignUpResult, CredentialAuthError>>;
  signIn(data: CredentialSignInData): Promise<DataResult<SignInResult, CredentialAuthError>>;
  resetPassword(data: ResetPasswordData): Promise<DataResult<void, CredentialAuthError>>;
  updatePassword(data: UpdatePasswordData): Promise<DataResult<void, CredentialAuthError>>;
  changePassword(data: ChangePasswordData): Promise<DataResult<void, CredentialAuthError>>;
  changeEmail(data: ChangeEmailData): Promise<DataResult<void, CredentialAuthError>>;
}
```

#### IOAuthAuthProvider (Apple/Google Sign-In — iOS Primarily)

```typescript
// lib/auth/oauth-auth-provider.interface.ts
interface IOAuthAuthProvider {
  readonly availableProviders: readonly ('apple' | 'google')[];
  signInWithApple(data: OAuthSignInData): Promise<DataResult<SignInResult, OAuthAuthError>>;
  signInWithGoogle?(data: OAuthSignInData): Promise<DataResult<SignInResult, OAuthAuthError>>;
  isAvailable(): boolean;
}
```

```swift
// iOS Mirror
protocol AuthProviderProtocol {
    func getCurrentUserId() async throws -> String
    func isAuthenticated() async throws -> Bool
    func signOut() async throws
    func getUser() async -> AuthUserEntity?
    func getSession() async -> AuthSessionEntity?
    func updateUserMetadata(firstName: String?, lastName: String?) async throws
    func onAuthStateChange(callback: @escaping (AuthEventType, AuthSessionEntity?) -> Void) -> () -> Void
}

protocol OAuthAuthProviderProtocol {
    var availableProviders: [OAuthProvider] { get }
    func signInWithApple(_ data: OAuthSignInData) async -> Result<SignInResult, OAuthAuthError>
    func isAvailable() -> Bool
}
```

### Auth Transformers

Supabase-to-domain mapping lives in `lib/data/data-transformers.ts`:

| Transformer | Input | Output | Key Behavior |
|-------------|-------|--------|--------------|
| `dbAuthUserToDomain` | Supabase `User` | `AuthUserEntity` | Maps `user_metadata.firstName/lastName`, throws on null `id` |
| `dbAuthSessionToDomain` | Supabase `Session` | `AuthSessionEntity` | Composes `dbAuthUserToDomain` for nested user |
| `dbAuthEventToDomain` | Supabase event string | `AuthEventType` | Maps `SIGNED_IN` → `'SIGNED_IN'`, etc. |
| `domainMetadataToSupabase` | Domain metadata | Supabase `user_metadata` | Atomic deep-merge, computes `full_name` for backward compat |

### Implementations

| Interface | Platform | Class | Location |
|-----------|----------|-------|----------|
| `IAuthProvider` | Web | `SupabaseAuthProvider` | `lib/auth/supabase-auth-provider.ts` |
| `IAuthProvider` | iOS | `AppleAuthProvider` | Native (future) |
| `ICredentialAuthProvider` | Web | `SupabaseCredentialProvider` | `lib/auth/supabase-credential-provider.ts` |
| `IOAuthAuthProvider` | iOS | `AppleOAuthProvider` | Native Apple Sign-In (future) |

#### SupabaseAuthProvider Key Behaviors

| Method | Behavior |
|--------|----------|
| `getCurrentUserId()` | Throws `AuthenticationError` (never returns null) — for services that require auth |
| `getUser()` | Returns `null` for `AuthSessionMissingError` — graceful identity for UI components |
| `updateUserMetadata()` | Atomic deep-merge via `domainMetadataToSupabase` — preserves existing metadata fields |
| `onAuthStateChange()` | Hash-based deduplication — skips redundant events to prevent unnecessary re-renders |

#### SupabaseCredentialProvider Key Behaviors

| Method | Behavior |
|--------|----------|
| `signUp()` | Returns `DataResult<SignUpResult>` — `needsEmailConfirmation: true` when session is null |
| `signIn()` | Returns `DataResult<SignInResult>` — maps Supabase errors to `CredentialErrorCode` |
| `changePassword()` | Two-step: `reauthenticate()` → `updateUser()` — returns `REAUTHENTICATION_FAILED` on step 1 failure |
| `changeEmail()` | Two-step: `reauthenticate()` → `updateUser()` — sends confirmation to new email |

#### Error Mapping (Supabase → CredentialErrorCode)

| Supabase Error | CredentialErrorCode |
|----------------|---------------------|
| "Invalid login credentials" | `INVALID_CREDENTIALS` |
| "Email not confirmed" | `EMAIL_NOT_CONFIRMED` |
| "User already registered" | `EMAIL_ALREADY_EXISTS` |
| Password validation failure | `WEAK_PASSWORD` |
| HTTP 429 | `RATE_LIMITED` |
| Reauthentication failure | `REAUTHENTICATION_FAILED` |

### IOC Injection Pattern (Auth API)

The auth API uses **factory pattern with multi-provider injection** at the composition root:

```typescript
// features/auth/api/auth.ts

// AuthApi type with provider access and capability checks
interface AuthApi {
  // Identity operations (IAuthProvider - all platforms)
  getUser: () => Promise<AuthUserEntity | null>;
  getSession: () => Promise<AuthSessionEntity | null>;
  logout: () => Promise<void>;
  updateUserMetadata: (data: UpdateProfileFormData) => Promise<void>;

  // Credential operations (ICredentialAuthProvider - web only)
  credential: ICredentialAuthProvider | null;

  // OAuth operations (IOAuthAuthProvider - iOS primarily)
  oauth: IOAuthAuthProvider | null;

  // Capability checks
  hasCredentialAuth: () => boolean;
  hasOAuthAuth: () => boolean;
  availableAuthMethods: () => AuthMethod[];
}

// Factory creates authApi bound to providers
export function createAuthApi(
  authProvider: IAuthProvider,
  credentialProvider?: ICredentialAuthProvider | null,
  oauthProvider?: IOAuthAuthProvider | null
): AuthApi {
  return {
    // Identity operations
    getUser: () => authProvider.getUser(),
    getSession: () => authProvider.getSession(),
    logout: async () => { await authProvider.signOut?.(); },
    updateUserMetadata: (data) => authProvider.updateUserMetadata(data),

    // Provider access
    credential: credentialProvider ?? null,
    oauth: oauthProvider ?? null,

    // Capability checks
    hasCredentialAuth: () => credentialProvider != null,
    hasOAuthAuth: () => oauthProvider != null && oauthProvider.isAvailable(),
    availableAuthMethods: () => {
      const methods: AuthMethod[] = [];
      if (credentialProvider) methods.push('credential');
      if (oauthProvider?.availableProviders.includes('apple')) methods.push('oauth_apple');
      if (oauthProvider?.availableProviders.includes('google')) methods.push('oauth_google');
      return methods;
    },
  };
}

// Singleton management
export function initAuthApi(
  authProvider: IAuthProvider,
  credentialProvider?: ICredentialAuthProvider | null,
  oauthProvider?: IOAuthAuthProvider | null
): void { _authApiInstance = createAuthApi(authProvider, credentialProvider, oauthProvider); }

export function getAuthApi(): AuthApi { /* ... */ }
export function isAuthApiInitialized(): boolean { /* ... */ }
```

### UI Usage Pattern (DataResult)

```typescript
// app/login/page.tsx
const onSubmit = async (data: LoginFormData) => {
  const credential = getAuthApi().credential;
  if (!credential) {
    setError('Credential authentication is not available');
    return;
  }

  const result = await credential.signIn({
    email: data.email,
    password: data.password,
  });

  if (!result.success) {
    setError(result.error.message);
    return;
  }

  router.push('/dashboard');
};
```

### Composition Root Initialization

The `AuthProvider` component initializes all providers at app startup:

```typescript
// providers/auth-provider.tsx
export function AuthProvider({ children }) {
  const { setUser, initialize } = useAuthStore();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // SINGLETON PROVIDERS: Initialize once at composition root
    const supabase = createClient();

    // Identity provider (all platforms)
    const authProvider = createSupabaseAuthProvider(supabase);

    // Credential provider (web only)
    const credentialProvider = createSupabaseCredentialProvider(supabase);

    // OAuth provider (iOS only - null on web)
    const oauthProvider = null;

    // IOC INJECTION: Inject all providers into authApi singleton
    if (!isAuthApiInitialized()) {
      initAuthApi(authProvider, credentialProvider, oauthProvider);
    }

    // Initialize auth store (now that authApi is ready)
    initialize();

    // Subscribe to auth changes with filtered events
    const unsubscribe = authProvider.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => unsubscribe();
  }, [initialize, setUser]);

  return <>{children}</>;
}
```

**Platform Configuration:**
- **Web:** Injects `credentialProvider`, `oauthProvider = null`
- **iOS (Future):** Injects `oauthProvider`, `credentialProvider = null`

### Service Layer Injection Pattern

Services use **constructor injection** of `IAuthProvider` (unchanged from before):

```typescript
class XService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly authProvider: IAuthProvider
  ) {}

  private async getCurrentUserId(): Promise<string> {
    return this.authProvider.getCurrentUserId();
  }
}

// Factory encapsulates provider creation
export function createXService(supabase: SupabaseClient): XService {
  const authProvider = createSupabaseAuthProvider(supabase);
  return new XService(supabase, authProvider);
}
```

React hooks wire DI via `useMemo`:

```typescript
function useXService() {
  return useMemo(() => {
    const supabase = createClient();
    return createXService(supabase);
  }, []);
}
```

### Migrated Services (Complete Inventory)

| Service | File | Injection Method |
|---------|------|-----------------|
| AccountService | `features/accounts/services/account-service.ts` | Constructor (repository + authProvider) |
| CategoryService | `features/categories/services/category-service.ts` | Constructor (repository + authProvider) |
| TransactionService | `features/transactions/services/transaction-service.ts` | Constructor (repository + authProvider) |
| TransferService | `features/transactions/services/transfer-service.ts` | Constructor (repository + authProvider) |
| InboxService | `features/inbox/services/inbox-service.ts` | Constructor (repository + authProvider) |
| TransactionRoutingService | `features/transactions/services/transaction-routing-service.ts` | Constructor (repository + authProvider) |
| UserSettingsService | `features/settings/api/user-settings.ts` | Constructor (supabase + authProvider) |
| ReconciliationsService | `features/reconciliations/api/reconciliations.ts` | Constructor (supabase + authProvider) |
| DataImportService | `features/import-export/services/data-import-service.ts` | Constructor (supabase + authProvider) |
| DataExportService | `features/import-export/services/data-export-service.ts` | Constructor (supabase + authProvider) |

### ESLint Gatekeeper Enforcement

The `eslint.config.mjs` enforces auth abstraction with `no-restricted-imports`:

```javascript
// Block direct Supabase imports in features (except repositories and auth API)
const authLockdownForFeatures = {
  files: ["features/**/*.ts", "features/**/*.tsx"],
  ignores: [
    "features/**/repository/**",
    "features/**/repositories/**",
    "features/auth/api/**",
  ],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [{
        group: ["@/lib/supabase/client", "@/lib/supabase/server"],
        message: "Direct Supabase imports are restricted in features. Use IAuthProvider from @/lib/auth for auth, or inject SupabaseClient via service factory.",
      }],
      paths: [{
        name: "@supabase/supabase-js",
        importNames: ["createClient"],
        message: "Use IAuthProvider from @/lib/auth instead of direct Supabase auth imports in features.",
      }],
    }],
  },
};
```

**Exemptions:**
- `features/**/repository/**` — Repositories need direct Supabase for data queries
- `features/auth/api/**` — Auth module needs direct Supabase for credential operations

### Allowed Direct `supabase.auth.*` Calls

| Location | Reason |
|----------|--------|
| `features/auth/api/auth.ts` | Credential operations (login, signup) — platform-specific |
| `lib/auth/supabase-auth-provider.ts` | Provider implementation — wraps all auth calls |
| `app/*/page.tsx` (server components) | Server-side route protection |
| `lib/supabase/middleware.ts` | Next.js middleware route guard |

### Key Files

| File | Purpose |
|------|---------|
| `domain/auth.ts` | Sacred auth types (AuthUserEntity, AuthSessionEntity, SignInResult, CredentialErrorCode, etc.) |
| `lib/auth/auth-provider.interface.ts` | IAuthProvider interface contract |
| `lib/auth/credential-auth-provider.interface.ts` | ICredentialAuthProvider interface contract |
| `lib/auth/oauth-auth-provider.interface.ts` | IOAuthAuthProvider interface contract |
| `lib/auth/supabase-auth-provider.ts` | Supabase identity provider implementation |
| `lib/auth/supabase-credential-provider.ts` | Supabase credential provider implementation (8 auth methods) |
| `lib/auth/index.ts` | Barrel exports for auth module |
| `lib/data/data-transformers.ts` | Auth transformers (dbAuthUserToDomain, etc.) |
| `features/auth/api/auth.ts` | Auth API with multi-provider IOC injection |
| `providers/auth-provider.tsx` | Composition root — initializes all providers |
| `stores/auth-store.ts` | Zustand store using AuthUserEntity |

### Rules for New Services

**DO:**
- ✅ Accept `IAuthProvider` via constructor injection for services
- ✅ Use `authProvider.getCurrentUserId()` for user identity in services
- ✅ Use `getAuthApi().getUser()` for user profile in components/hooks
- ✅ Use `getAuthApi().credential?.signIn()` for credential operations (returns DataResult)
- ✅ Check `result.success` before accessing `result.data` (DataResult pattern)
- ✅ Export a factory function that creates the auth provider internally
- ✅ Wire hooks via `useMemo` with `createSupabaseAuthProvider`

**DON'T:**
- ❌ Call `supabase.auth.getUser()` from any service or component in `features/` (except `features/auth/api/`)
- ❌ Import `@/lib/supabase/client` in feature files (ESLint will block it)
- ❌ Pass raw `userId` strings between methods — inject `IAuthProvider` and let the service decide when to fetch
- ❌ Return `null` from `getCurrentUserId()` — throw `AuthenticationError` (but `getUser()` can return `null`)
- ❌ Put raw Supabase auth logic in `.tsx` files — use `getAuthApi()` or hooks with `createSupabaseAuthProvider`
- ❌ Use try/catch for credential operations — use DataResult pattern (`if (!result.success) { ... }`)

## 11. Zod Network Boundary Validation (Schema Contracts)

### Overview

Every Supabase response is validated with Zod schemas **before** reaching `data-transformers.ts`. If the server sends malformed data, the app crashes at the network boundary — not deep inside a React component. This is the "Silent Guard" pattern: Contract-Verified data integrity at the edge.

**Status:** ✅ **IMPLEMENTED** — All repository, API, and sync engine boundaries covered.

### Why This Exists

1. **Early Crash Principle:** A renamed Postgres column causes `SchemaValidationError` at the boundary instead of `undefined` rendering in React or a Swift crash on iOS.
2. **iOS Bridge:** Zod schemas serve as executable documentation of what Supabase returns. The iOS developer reads the schema and knows `accountName` is `string | null` and `amountCents` is an integer.
3. **Frozen API Contract:** The schemas lock the server's output shape. Backend changes that break the contract are caught immediately on the web, before the iOS app ever sees the bad data.

### Architecture

```
Supabase RPC / .from() Query
    │
    ▼
Zod Schema Validation (db-row-schemas.ts)    ← "Filtering Membrane"
    │   - validateOrThrow() / validateArrayOrThrow()
    │   - SchemaValidationError with schemaName for error boundaries
    │   - Rejects floats on integer cents fields
    │   - Enforces nullable vs optional distinction
    ▼
Shared Transformers (data-transformers.ts)    ← Existing (unchanged)
    │
    ▼
Domain Entities
```

### Key Files

| File | Purpose |
|------|---------|
| `lib/data/db-row-schemas.ts` | Centralized Zod schemas — table rows, view rows, RPC responses, sync records |
| `lib/data/validate.ts` | `validateOrThrow<T>()`, `validateArrayOrThrow<T>()`, `SchemaValidationError` |
| `lib/data/__tests__/db-row-schemas.test.ts` | Schema contract tests |
| `lib/data/__tests__/validate.test.ts` | Helper tests |

### Two Schema Sets (Critical Design Decision)

The codebase has two paths from Supabase to domain:

1. **Repository/API path** — uses `.from('table').select()` → column names match `database.types.ts` (e.g., `amount_original`, `amount_home`, `current_balance`)
2. **Sync pull-engine path** — uses `.rpc('get_changes_since')` → RPC renames columns (e.g., `amount_cents`, `amount_home_cents`, `current_balance_cents`)

Therefore `db-row-schemas.ts` contains **two separate schema sets**:
- **Table Row Schemas** — for repositories (`BankAccountRowSchema`, `TransactionRowSchema`, etc.)
- **Sync Record Schemas** — for pull-engine (`SyncRecordSchemas.bank_accounts`, etc.) with `.passthrough()` to tolerate new DB columns

### Schema Design Rules

| Rule | Rationale |
|------|-----------|
| `z.number().int()` on all `_cents` fields | Rejects `100.5` — protects Sacred Integer Arithmetic |
| `.nullable()` for Postgres NULL | Matches domain null semantics for iOS Swift compatibility |
| `.optional()` only for migration-pending fields | Sync fields on `bank_accounts`/`transaction_inbox` aren't in auto-generated types yet (`categories` now uses required `BaseSyncFields`) |
| `.passthrough()` on sync schemas | New DB columns from migrations don't break the web app |
| `BaseSyncFields` shared object | DRY — `version` and `deleted_at` defined once, spread into each schema |
| `z.record(z.string(), z.unknown())` | Zod v4 requires explicit key type for record schemas |

### Wiring Points

**Sync Engine (3 points in `lib/sync/pull-engine.ts`):**
- After `get_sync_changes_summary_v2()` RPC → `SyncChangesSummarySchema`
- After `get_changes_since()` RPC → `ChangesResponseSchema`
- Per-record in fetch loop → `SyncRecordSchemas[tableName]`

**Repositories/APIs (6 files):**
- `features/accounts/repository/supabase-account-repository.ts` → `BankAccountViewRowSchema`
- `features/categories/repository/supabase-category-repository.ts` → `CategoryRowSchema`, `ParentCategoryWithCountRowSchema`
- `features/transactions/repository/supabase-transaction-repository.ts` → `TransactionsViewRowSchema`
- `features/inbox/repository/supabase-inbox-repository.ts` → `TransactionInboxViewRowSchema`
- `features/reconciliations/api/reconciliations.ts` → `ReconciliationRowSchema`, `ReconciliationSummaryRpcSchema`, `LinkUnlinkRpcSchema`
- `features/settings/api/user-settings.ts` → `UserSettingsRowSchema`

### Error Handling

`SchemaValidationError` carries:
- `schemaName` — identifies which table/RPC failed (e.g., `SyncRecord[transactions]`, `BankAccountViewRow[3]`)
- `issues` — Zod issue array for debugging
- `rawData` — the malformed payload

This is caught by existing `try/catch` blocks in repositories (DataResult pattern) and propagates to global error boundaries with full context.

### Rules for Adding New Schemas

**DO:**
- ✅ Add a schema in `db-row-schemas.ts` for every new Supabase query or RPC
- ✅ Validate before transforming — `validateOrThrow(schema, data, 'Name')` then pass to transformer
- ✅ Use `BaseSyncFields` spread for syncable tables
- ✅ Use `.passthrough()` for sync record schemas

**DON'T:**
- ❌ Skip validation on any Supabase response ("naked data")
- ❌ Use `as any` or `as unknown as T` to bypass type checking on RPC responses
- ❌ Define schemas inline in repository files — centralize in `db-row-schemas.ts`
- ❌ Use `.optional()` where `.nullable()` is correct (Postgres NULL = nullable)

## 12. Observability Architecture (Sentry)

### Overview

Production error tracking via `@sentry/nextjs` with a **privacy-first** architecture. Every Sentry event is scrubbed of financial PII before it leaves the browser. The integration covers three runtime environments (client, server, edge) and instruments the sync engine, service layer, and UI error boundaries.

**Status:** ✅ **IMPLEMENTED**

### Guiding Principle: Privacy-First Financial Telemetry

We are handling people's money. An error report that leaks a transaction description or account balance is a privacy audit failure. All Sentry events pass through a PII scrubber before transmission.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  UI Components (React)                                          │
│  - Feature-level SentryErrorBoundary per domain                 │
│  - Crash in AccountList does NOT white-screen Dashboard         │
└─────────────────────┬───────────────────────────────────────────┘
                      │ componentDidCatch
┌─────────────────────▼───────────────────────────────────────────┐
│  Service Layer                                                   │
│  - InboxService: reportIfFailed() on create/promote/dismiss     │
│  - TransactionService: errors thrown → caught by boundaries     │
│  - Reporter maps DomainError.code → Sentry severity             │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│  Sync Engine                                                     │
│  - DeltaSyncEngine: Sentry.captureException on push/pull/cycle  │
│  - PullEngine: SchemaValidationError → keys-only capture        │
│  - SyncStatusProvider: onSyncError → Sentry capture             │
│  - Version tags: sync.currentServerVersion, sync.phase          │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│  PII Scrubber (lib/sentry/scrubber.ts)                          │
│  - beforeSend callback: allowlist approach                       │
│  - Safe fields pass through (id, version, timestamps, status)   │
│  - Sensitive fields → [REDACTED]                                 │
│  - Unknown fields → [SCRUBBED]                                   │
│  - SchemaValidationError.rawData → keys only, never values      │
│  - Monetary regex scrub on breadcrumb messages                   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│  Sentry Cloud                                                    │
│  - Zero financial PII in events                                  │
│  - Tags: domain, sync.phase, error.code, build_version          │
│  - Severity: warning (conflicts), error (not found), fatal (DB) │
└─────────────────────────────────────────────────────────────────┘
```

### PII Scrubbing Rules

**Allowlist approach** — only known-safe fields pass through. Everything else is scrubbed.

| Category | Fields | Treatment |
|----------|--------|-----------|
| **Safe (pass through)** | `id`, `user_id`, `version`, `sync_status`, `code`, `type`, `status`, `phase`, timestamps, foreign keys (`account_id`, `category_id`, etc.) | Unchanged |
| **Sensitive (redacted)** | `amount_original`, `amount_home`, `amount_cents`, `description`, `notes`, `source_text`, `exchange_rate`, `current_balance`, `name` (account), `currency_code`, `main_currency` | `[REDACTED]` |
| **Unknown** | Any field not in either list | `[SCRUBBED]` |

For `SchemaValidationError`, only the **keys** of `rawData` are sent — never the values. This allows debugging schema mismatches ("field `exchange_rate` was missing") without exposing financial data.

### Key Files

| File | Purpose |
|------|---------|
| `sentry.client.config.ts` | Browser SDK init — imports `beforeSend`/`beforeBreadcrumb` from `scrubber.ts` for allowlist-based PII filtering |
| `sentry.server.config.ts` | Server SDK init (`sendDefaultPii: false`, DSN via `process.env.SENTRY_DSN`) |
| `sentry.edge.config.ts` | Edge runtime SDK init (`sendDefaultPii: false`, DSN via `process.env.SENTRY_DSN`) |
| `instrumentation-client.ts` | Client instrumentation hooks (router transition tracking only — no `Sentry.init`, that lives in `sentry.client.config.ts`) |
| `lib/sentry/scrubber.ts` | `beforeSend` / `beforeBreadcrumb` — PII allowlist filter |
| `lib/sentry/reporter.ts` | `reportError()` / `reportServiceFailure()` — DomainError.code → severity mapper. Accepts `Error \| SerializableError` so domain DataResult errors (e.g., `InboxError`) work without forced `extends Error` |
| `providers/sentry-provider.tsx` | Sets `Sentry.setUser({ id })` on auth (ID only — no email, no username) |
| `components/sentry-error-boundary.tsx` | Reusable feature-level React error boundary with domain tagging |
| `app/error.tsx` | Next.js error page — catches unhandled errors within layout |
| `app/global-error.tsx` | Root layout fallback — last resort when layout itself crashes |

### Error Severity Mapping

The reporter (`lib/sentry/reporter.ts`) maps `DomainError.code` to Sentry severity levels:

| Severity | Error Codes | Meaning |
|----------|-------------|---------|
| `warning` | `VERSION_CONFLICT`, `VALIDATION_ERROR`, `TRANSACTION_DELETED`, `ALREADY_PROCESSED` | Expected errors — user can recover |
| `error` | `TRANSACTION_NOT_FOUND`, `NOT_FOUND`, `AUTHENTICATION_ERROR`, `PROMOTION_FAILED` | Unexpected — indicates a bug |
| `fatal` | `REPOSITORY_ERROR`, `UNEXPECTED_ERROR` | Infrastructure failure |

### Feature-Level Error Boundaries

Each major UI domain is wrapped in its own `SentryErrorBoundary`. A crash in one domain does not white-screen the entire app.

| Boundary Location | Domain Tag | Wraps |
|-------------------|------------|-------|
| `app/dashboard/page.tsx` | `dashboard` | `<DashboardContent />` |
| `app/transactions/page.tsx` | `transactions` | `<AllTransactionsTable />` |
| `app/inbox/page.tsx` | `inbox` | `<InboxTable />` |
| `components/layout/sidebar.tsx` | `accounts` | `<AccountList />` |

### Sync Engine Instrumentation

The sync engine (runs every 30s) is the highest-ROI instrumentation target. All `console.error()` calls in the engine have been replaced with `Sentry.captureException()` with structured tags:

| Tag | Values | Purpose |
|-----|--------|---------|
| `domain` | `'sync'` | Filter all sync-related errors |
| `sync.phase` | `'push'`, `'pull'`, `'error'` | Identify which sync phase failed |
| `sync.outcome` | `'silent_failure'` | Non-throwing `SyncCycleResult.success === false` (captured in `SyncStatusProvider`) |
| `errorType` | `'schema_validation'` | Flag SchemaValidationError specifically |
| `build_version` | `NEXT_PUBLIC_BUILD_VERSION` | Correlate schema mismatches with stale bundles |

### Version Mismatch Guard

When a `SchemaValidationError` occurs during pull (server schema changed but client bundle is stale):

1. Sends a `captureMessage` to Sentry at `warning` level with `build_version` tag
2. Forces `window.location.reload()` to fetch the latest client bundle
3. Prevents false-positive error floods after DB migrations

This is implemented in `lib/sync/pull-engine.ts` in the `pullIncrementalChanges` catch block.

### Offline-Sentry Buffer

Sentry's transport buffer is capped at 30 events (`transportOptions.bufferSize`) to avoid competing with WatermelonDB's IndexedDB storage (`finance_tracker_local` using `LokiJSAdapter` with `useIncrementalIndexedDB`). Events are buffered in memory when offline and flushed on reconnection.

### Provider Hierarchy

`SentryProvider` is the **outermost** wrapper in `ClientProviders` — before `QueryProvider`, `LocalDbProvider`, and all other providers. This ensures Sentry is initialized before any lower provider can crash during initialization.

```
SentryProvider          ← Outermost (error tracking + user context)
  QueryProvider         ← React Query
    LocalDbProvider     ← WatermelonDB (SSR disabled)
      CurrencyProvider
        AuthProvider
          SyncStatusProvider
            TransactionModalProvider
              {children}
              <Toaster />
```

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SENTRY_DSN` | Yes | Sentry project DSN (from Sentry dashboard → Project Settings → Client Keys) |
| `NEXT_PUBLIC_BUILD_VERSION` | Recommended | Build version string (e.g., `2026.01.27.01`) — used by Version Mismatch Guard. Set statically in `.env.local` for dev; auto-generated by `prebuild` script for production (`YYYY.MM.DD.HHMM` → `.env.production.local`) |
| `SENTRY_AUTH_TOKEN` | Optional | Source map upload token for CI/CD builds |

### Rules for New Features

**DO:**
- ✅ Wrap new page-level feature components in `<SentryErrorBoundary domain="your-domain">`
- ✅ Use `reportServiceFailure()` from `lib/sentry/reporter.ts` for DataResult failures in services
- ✅ Add new DomainError codes to the severity map in `lib/sentry/reporter.ts`
- ✅ Use structured tags (`domain`, `error.code`) — not string messages — for Sentry filtering
- ✅ Add new sensitive fields to the `SENSITIVE_FIELDS` set in `lib/sentry/scrubber.ts`

**DON'T:**
- ❌ Use `console.error()` for production error reporting — use `Sentry.captureException()`
- ❌ Include financial data (amounts, descriptions, notes, balances) in Sentry `extra` context
- ❌ Set `Sentry.setUser()` with email or username — ID only
- ❌ Use `Sentry.captureException()` for expected network errors (sync retries handle these)
- ❌ Skip the PII scrubber by constructing events manually

## 13. Cross-Feature IoC Pattern (IGroupingOperations)

### Overview

Features that need to access another feature's service layer MUST go through an **orchestrator hook** in `lib/hooks/`. This enforces Inversion of Control (IoC) — features depend on interfaces in the Sacred Domain, not concrete implementations in other features.

**Status:** ✅ **IMPLEMENTED** — Groupings feature decoupled from Categories feature.

### Problem Statement

The groupings feature (`features/groupings/`) needed `CategoryService` methods to manage parent categories. Direct imports violated feature boundaries:

```typescript
// ❌ VIOLATION: Feature importing from another feature's internal hooks
import { useCategoryService } from '@/features/categories/hooks/use-category-service';
```

### Solution: Orchestrator Hook Pattern

**Three-layer architecture:**

1. **Sacred Domain (`@/domain/categories`)** — Platform-agnostic interface + error codes
2. **Orchestrator Hook (`@/lib/hooks/use-grouping-operations`)** — Wraps service, translates errors
3. **Feature Hooks (`features/groupings/hooks/use-groupings`)** — Consumes orchestrator, never the service directly

```
┌─────────────────────────────────────────────────────────────────┐
│  features/groupings/hooks/use-groupings.ts                       │
│  - Imports from @/domain/categories (types + error guards)       │
│  - Imports from @/lib/hooks/use-grouping-operations (orchestrator)│
│  - NEVER imports from @/features/categories/*                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  lib/hooks/use-grouping-operations.ts (ORCHESTRATOR)             │
│  - Wraps useCategoryService() internally                         │
│  - Error translation: CategoryError → GroupingOperationError     │
│  - Stable memoization via useRef                                 │
│  - Returns IGroupingOperations | null (Orchestrator Rule)        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  domain/categories.ts (SACRED DOMAIN)                            │
│  - IGroupingOperations interface                                 │
│  - GroupingErrorCode union type                                  │
│  - GroupingOperationError interface                              │
│  - DTOs: CreateGroupingDTO, UpdateGroupingDTO, etc.              │
│  - Entities: GroupingEntity, CategoryWithCountEntity             │
└─────────────────────────────────────────────────────────────────┘
```

### Error Code Translation

The orchestrator translates feature-level errors to Sacred Domain error codes:

| Feature Error Class | → | Domain Error Code |
|---------------------|---|-------------------|
| `CategoryDuplicateNameError` | → | `'DUPLICATE_NAME'` |
| `CategoryHasChildrenError` | → | `'HAS_CHILDREN'` |
| `CategoryHasTransactionsError` | → | `'HAS_TRANSACTIONS'` |
| `CategoryHierarchyError` | → | `'INVALID_HIERARCHY'` |
| `CategoryVersionConflictError` | → | `'VERSION_CONFLICT'` |
| `CategoryNotFoundError` | → | `'NOT_FOUND'` |

Consumers handle errors with typed switch statements:

```typescript
onError: (err) => {
  if (isGroupingOperationError(err)) {
    switch (err.code) {
      case 'DUPLICATE_NAME':
        toast.error('Grouping already exists');
        break;
      case 'HAS_CHILDREN':
        toast.error(`Has ${err.childCount} subcategories`);
        break;
      // ...
    }
  }
}
```

### Memoization Stability

The orchestrator uses `useRef` to maintain stable object identity:

```typescript
export function useGroupingOperations(): IGroupingOperations | null {
  const service = useCategoryService();
  const operationsRef = useRef<IGroupingOperations | null>(null);
  const serviceRef = useRef(service);

  return useMemo(() => {
    if (!service) {
      operationsRef.current = null;
      return null;
    }

    // Only create new object if service reference changed
    if (serviceRef.current !== service || !operationsRef.current) {
      serviceRef.current = service;
      operationsRef.current = { /* ... methods ... */ };
    }

    return operationsRef.current;
  }, [service]);
}
```

This prevents cascading re-renders when `useGroupingOperations()` is consumed by multiple hooks.

### Error Type Standards for IoC Interfaces

**Critical Rule:** IoC interfaces that return `DataResult<T>` MUST use `SerializableError` as the error type parameter, NOT the default `Error`.

```typescript
// ✅ CORRECT: Use SerializableError for IoC interface methods
import type { DataResult, SerializableError } from '@/lib/data-patterns/types';

export interface IInboxOperations {
  create(data: CreateInboxItemDTO): Promise<DataResult<InboxItemViewEntity, SerializableError>>;
  update(id: string, data: UpdateInboxItemDTO): Promise<DataResult<InboxItemViewEntity, SerializableError>>;
  promote(data: PromoteInboxItemDTO): Promise<DataResult<PromoteResult, SerializableError>>;
}

// ❌ WRONG: Default Error type causes type incompatibility
export interface IInboxOperations {
  create(data: CreateInboxItemDTO): Promise<DataResult<InboxItemViewEntity>>;  // Defaults to Error
}
```

**Why This Matters:**

Feature-specific error types (e.g., `InboxError`, `CategoryError`) extend `SerializableError` for Swift compatibility — they have `code` and `message` but NOT `name`. The built-in `Error` type requires `name`, causing type incompatibility:

```
Type 'InboxError' is not assignable to type 'Error'.
  Property 'name' is missing in type 'InboxError' but required in type 'Error'.
```

| Type | Properties | Swift Compatible |
|------|------------|-----------------|
| `Error` (built-in) | `name`, `message`, `stack?` | ❌ No (`name` is runtime-only) |
| `SerializableError` | `code`, `message` | ✅ Yes (JSON-serializable) |
| `InboxError` | `code` (union), `message` | ✅ Yes (extends SerializableError) |

**Affected Interfaces:**

| Interface | Location | Error Type |
|-----------|----------|------------|
| `IInboxOperations` | `domain/inbox.ts` | `SerializableError` |
| `IGroupingOperations` | `domain/categories.ts` | Uses error code translation (no DataResult) |

### Key Files

| File | Purpose |
|------|---------|
| `domain/categories.ts` | `IGroupingOperations`, `GroupingErrorCode`, `GroupingOperationError`, DTOs |
| `domain/inbox.ts` | `IInboxOperations` with `SerializableError`-typed DataResult returns |
| `lib/hooks/use-grouping-operations.ts` | Orchestrator hook with error translation |
| `lib/hooks/use-inbox-operations.ts` | Orchestrator hook wrapping InboxService |
| `features/groupings/hooks/use-groupings.ts` | Consumer hooks (queries + mutations) |

### Rules for Cross-Feature Dependencies

**DO:**
- ✅ Define interfaces in `@/domain/` for cross-feature contracts
- ✅ Create orchestrator hooks in `@/lib/hooks/` that wrap feature services
- ✅ Translate feature errors to domain error codes in the orchestrator
- ✅ Use `useRef` for stable memoization in orchestrator hooks
- ✅ Import types from `@/domain/` in consuming features
- ✅ Use `DataResult<T, SerializableError>` for IoC interface return types (not `DataResult<T>`)

**DON'T:**
- ❌ Import from `@/features/other-feature/hooks/*` in feature code
- ❌ Import from `@/features/other-feature/services/*` in feature code
- ❌ Use `instanceof` error checks in consuming features — use error codes
- ❌ Create new objects on every render in orchestrator hooks
- ❌ Use default `DataResult<T>` (which uses `Error`) for IoC interfaces — use `DataResult<T, SerializableError>`
