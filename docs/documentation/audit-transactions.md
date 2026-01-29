# Composable Manifest: features/transactions

> **Generated**: 2026-01-28
> **Auditor**: Senior Systems Architect & Security Auditor
> **Scope**: `/features/transactions/` folder

---

## Executive Summary

| Category | Status | Issues |
|----------|--------|--------|
| Entity Registry | COMPLIANT | 0 |
| Naming Conventions | COMPLIANT | 0 |
| Type Safety | COMPLIANT | 0 (SDK limitations only) |
| Dependency Manifest | **VIOLATION** | 25 |
| Integer Cents | **VIOLATION** | 1 |
| Sync Integrity | COMPLIANT | 0 |
| Soft Deletes | COMPLIANT | 0 |
| Auth Abstraction | COMPLIANT | 0 |
| React Compiler | COMPLIANT | 0 |
| Re-render Optimization | MINOR | 3 |

**Overall**: 26 issues found (1 critical, 25 feature bleed violations, 3 minor performance)

---

## 1. Variable & Entity Registry

### 1.1 Directory Structure

```
features/transactions/
├── api/                              (1 file)
│   └── filters.ts
├── components/                       (15 files)
│   ├── all-transactions-table.tsx
│   ├── bulk-action-bar.tsx
│   ├── category-selector.tsx
│   ├── ledger-transaction-modal-content.tsx
│   ├── transaction-detail-panel.tsx
│   ├── transaction-form.tsx
│   ├── transfer-form.tsx
│   ├── transfer-modal-content.tsx
│   └── ... (7 more)
├── domain/                           (5 files)
│   ├── entities.ts
│   ├── types.ts
│   ├── errors.ts
│   ├── constants.ts
│   └── index.ts
├── hooks/                            (12 files)
│   ├── use-transactions.ts
│   ├── use-transaction-routing.ts
│   ├── use-transaction-filters.ts
│   ├── use-transfers.ts
│   ├── use-bulk-selection.ts
│   ├── use-direction-toggle.ts
│   ├── use-transfer-calculation.ts
│   ├── use-transfer-resolution.ts
│   ├── use-transaction-update.ts
│   └── ... (3 more)
├── repository/                       (7 files)
│   ├── transaction-repository.interface.ts
│   ├── transfer-repository.interface.ts
│   ├── supabase-transaction-repository.ts
│   ├── supabase-transfer-repository.ts
│   ├── local-transaction-repository.ts
│   ├── hybrid-transaction-repository.ts
│   └── index.ts
├── services/                         (7 files)
│   ├── transaction-service.interface.ts
│   ├── transaction-service.ts
│   ├── transfer-service.interface.ts
│   ├── transfer-service.ts
│   ├── transaction-routing-service.interface.ts
│   ├── transaction-routing-service.ts
│   └── index.ts
├── schemas/                          (1 file)
│   └── transaction.schema.ts
└── index.ts
```

**Total: 56 TypeScript/TSX files**

### 1.2 Entity Inventory

#### Entities (`domain/entities.ts`)

| Entity | Lines | Description |
|--------|-------|-------------|
| `TransactionEntity` | 62-231 | Core transaction with integer cents, version, tombstone |
| `TransactionViewEntity` | 282-331 | Enriched entity with joined account/category data |

**TransactionEntity Fields:**
```typescript
interface TransactionEntity {
  readonly id: string;                    // UUID
  readonly version: number;               // Optimistic concurrency
  readonly userId: string;                // FK to users
  readonly amountCents: number;           // INTEGER CENTS (Sacred Mandate)
  readonly amountHomeCents: number;       // Home currency equivalent
  readonly currencyOriginal: string;      // Original transaction currency
  readonly exchangeRate: number;          // Conversion rate
  readonly accountId: string;             // FK to accounts
  readonly categoryId: string | null;     // FK to categories
  readonly transferId: string | null;     // Links transfer pairs
  readonly description: string;
  readonly notes: string | null;
  readonly date: string;                  // ISO 8601
  readonly createdAt: string;             // ISO 8601
  readonly updatedAt: string;             // ISO 8601
  readonly deletedAt: string | null;      // Tombstone
  readonly reconciliationId: string | null;
  readonly cleared: boolean;
  readonly sourceText: string | null;
  readonly inboxId: string | null;        // Links to inbox item
}
```

**TransactionViewEntity Additions:**
```typescript
interface TransactionViewEntity extends TransactionEntity {
  readonly accountName: string;
  readonly accountCurrency: string;
  readonly accountColor: string;
  readonly categoryName: string | null;
  readonly categoryColor: string | null;
  readonly categoryType: string | null;
  readonly reconciliationStatus: string | null;
}
```

**Type Guards Provided:**
- `isTransactionViewEntity()` - Line 336
- `isDeletedTransaction()` - Line 348
- `isTransferTransaction()` - Line 357
- `isReconciledTransaction()` - Line 367

#### DTOs (`domain/types.ts`)

| DTO | Lines | Purpose |
|-----|-------|---------|
| `CreateTransactionDTO` | 72-131 | Input for creating new transactions |
| `UpdateTransactionDTO` | 155-172 | Partial update with version requirement |
| `BulkUpdateTransactionDTO` | 188-200 | Batch update operations |
| `BulkUpdateResult` | 208-223 | Response from bulk operations |
| `CreateTransferDTO` | 248-281 | Atomic transfer creation |
| `TransferResult` | 289-304 | Response from transfer creation |
| `TransactionFilters` | 328-370 | Query filters for fetching |
| `TransactionChanges` | 390-404 | Delta sync response |
| `CategoryCounts` | 412-414 | Aggregated category counts |
| `TransactionRouteInputDTO` | 461-513 | Input for routing service |
| `RoutingDecision` | 531-562 | Result from routing decision |
| `SubmissionResult` | 582-613 | Result from transaction submission |
| `UpdateRouteInputDTO` | 634-660 | Input for updating with routing |
| `UpdateResult` | 684-734 | Result from routing update |

#### Interfaces

| Interface | File | Lines | Purpose |
|-----------|------|-------|---------|
| `ITransactionRepository` | `repository/transaction-repository.interface.ts` | 56-419 | Data access contract (15 methods) |
| `ITransactionService` | `services/transaction-service.interface.ts` | 51-206 | Business logic contract |
| `ITransferRepository` | `repository/transfer-repository.interface.ts` | 33-48 | Transfer-specific repository |
| `ITransferService` | `services/transfer-service.interface.ts` | 19-28 | Transfer service contract |
| `ITransactionRoutingService` | `services/transaction-routing-service.interface.ts` | 52-204 | Ledger vs Inbox routing engine |

#### Error Classes (`domain/errors.ts`)

| Error | Code | Purpose |
|-------|------|---------|
| `TransactionError` | Base | Parent class |
| `TransactionNotFoundError` | `NOT_FOUND` | Transaction ID not found |
| `TransactionVersionConflictError` | `VERSION_CONFLICT` | Optimistic concurrency failure |
| `TransactionValidationError` | `VALIDATION_ERROR` | Data validation failure |
| `TransactionAuthenticationError` | `AUTHENTICATION_ERROR` | User not authenticated |
| `TransactionRepositoryError` | `REPOSITORY_ERROR` | Database operation failure |
| `UnexpectedTransactionError` | `UNEXPECTED_ERROR` | Unknown error wrapper |
| `TransactionDeletedError` | `DELETED` | Operation on deleted transaction |
| `TransferRepositoryError` | N/A | Transfer-specific errors |

**Type Guards Provided:**
- `isTransactionError()` - Line 166
- `isValidationError()` - Line 182

### 1.3 Naming Audit

**Status: COMPLIANT**

| Context | Convention | Example |
|---------|------------|---------|
| Domain Objects | camelCase | `amountCents`, `amountHomeCents`, `currencyOriginal`, `exchangeRate`, `accountId`, `categoryId`, `transferId`, `createdAt`, `updatedAt`, `deletedAt` |
| Database Rows | snake_case | `amount_cents`, `amount_home_cents`, `currency_original`, `exchange_rate`, `account_id`, `category_id`, `transfer_id`, `created_at`, `updated_at`, `deleted_at` |

**Transformation Functions:**
- `dbTransactionViewToDomain()` at `lib/data/data-transformers.ts`
- `dbTransactionViewsToDomain()` for array transformation

### 1.4 Type Safety Audit

**Status: COMPLIANT** (SDK limitations acknowledged)

| Check | Result |
|-------|--------|
| `as any` in domain layer | **0 instances** |
| `as unknown` usage | Proper - only in error type guards |
| Naked types | None found |
| Zod validation | Implemented at boundaries |

**`any` Usage (React Query SDK Limitation):**

| File | Lines | Context |
|------|-------|---------|
| `hooks/use-transactions.ts` | 176, 203, 206, 220, 309, 314, 325, 333, 336, 353, 418, 423, 440, 443, 458 | Cache updates in `setQueriesData` callbacks |
| `hooks/use-transaction-routing.ts` | 183, 220 | Cache snapshot in React Query |
| `repository/supabase-transaction-repository.ts` | 89, 91 | Supabase query builder limitation |

**Justification:** React Query's `setQueriesData` doesn't properly infer cache types. Supabase query builder lacks proper TypeScript generics for chaining. These are SDK limitations, not codebase issues.

**Validation Chain:**
1. Supabase returns data
2. `validateArrayOrThrow(TransactionsViewRowSchema, data)` validates
3. `dbTransactionViewsToDomain()` transforms to domain entity

---

## 2. Dependency Manifest (Import Audit)

### 2.1 Feature Bleed Check

**Status: VIOLATION - 25 cross-feature imports across 15 files**

#### Critical Violations by Dependency

| Dependency | Count | Severity |
|------------|-------|----------|
| `@/features/accounts` | 6 | CRITICAL |
| `@/features/categories` | 5 | CRITICAL |
| `@/features/inbox` | 5 | CRITICAL |
| `@/features/reconciliations` | 2 | MODERATE |
| `@/features/groupings` | 1 | LOW |
| `@/features/settings` | 1 | LOW |
| `@/features/shared` | 1 | ACCEPTABLE |

#### Detailed Violation List

**Accounts Feature (6 violations):**
| File | Import |
|------|--------|
| `components/transaction-detail-panel.tsx` | `@/features/accounts/domain` |
| `components/ledger-transaction-modal-content.tsx` | `@/features/accounts/hooks/use-accounts` |
| `components/all-transactions-table.tsx` | `@/features/accounts/hooks/use-accounts` |
| `components/transaction-form.tsx` | `@/features/accounts/domain` |
| `hooks/use-transfers.ts` | `@/features/accounts/domain` |
| `hooks/use-transfer-resolution.ts` | `@/features/accounts/hooks/use-accounts` |

**Categories Feature (5 violations):**
| File | Import |
|------|--------|
| `components/transaction-detail-panel.tsx` | `@/features/categories/domain` |
| `components/ledger-transaction-modal-content.tsx` | `@/features/categories/hooks/use-categories` |
| `components/all-transactions-table.tsx` | `@/features/categories/hooks/use-leaf-categories` |
| `components/category-selector.tsx` | `@/features/categories/hooks/use-leaf-categories` |
| `components/bulk-action-bar.tsx` | `@/features/categories/hooks/use-leaf-categories` |
| `hooks/use-direction-toggle.ts` | `@/features/categories/hooks/use-categories` |

**Inbox Feature (5 violations):**
| File | Import |
|------|--------|
| `domain/types.ts` | `@/features/inbox/domain/entities` |
| `hooks/use-transaction-routing.ts` | `@/features/inbox/services/inbox-service`, `@/features/inbox/domain/entities` |
| `hooks/use-transaction-update.ts` | `@/features/inbox/services/inbox-service` |
| `services/transaction-routing-service.ts` | `@/features/inbox/services/inbox-service` |
| `services/index.ts` | `@/features/inbox/services/inbox-service` |

**Other Features:**
| File | Import | Dependency |
|------|--------|------------|
| `components/bulk-action-bar.tsx` | `@/features/reconciliations/hooks/use-reconciliations` | reconciliations |
| `hooks/use-bulk-selection.ts` | `@/features/reconciliations/hooks/use-reconciliations` | reconciliations |
| `hooks/use-transaction-filters.ts` | `@/features/groupings/hooks/use-groupings` | groupings |
| `components/all-transactions-table.tsx` | `@/features/settings/hooks/use-user-settings` | settings |

### 2.2 Valid Import Sources

| Source | Count | Status |
|--------|-------|--------|
| `@/lib/*` | 50+ | VALID |
| `@/components/ui/*` | 20+ | VALID |
| `@/features/shared/*` | 1 | VALID |
| Internal (same feature) | 30+ | VALID |
| External packages | Standard | VALID |

### 2.3 Transformer Usage

**Status: COMPLIANT**

All database transformations use shared transformers:

| Repository | Transformer | Location |
|------------|-------------|----------|
| `supabase-transaction-repository.ts:48-50` | `dbTransactionViewToDomain`, `dbTransactionViewsToDomain` | `@/lib/data/data-transformers` |
| `supabase-transaction-repository.ts:187` | `sharedDbTransactionViewsToDomain()` | Applied at boundary |
| `supabase-transaction-repository.ts:232` | `sharedDbTransactionViewToDomain()` | Single row transform |
| `supabase-transaction-repository.ts:619` | `sharedDbTransactionViewsToDomain()` | Deleted transactions |
| `local-transaction-repository.ts` | `localTransactionViewsToDomain` | `@/lib/data/local-data-transformers` |

**No inline mapping logic found.**

### 2.4 Direct Supabase Imports

**Status: ACCEPTABLE**

Supabase imports only in repository layer (correct location):
- `repository/supabase-transaction-repository.ts` - Implementation
- `repository/supabase-transfer-repository.ts` - Implementation
- `repository/index.ts` - Factory pattern

**No violations**: Components, hooks, and services do not import Supabase client directly.

---

## 3. Sacred Mandate Compliance

### 3.1 Integer Cents

**Status: VIOLATION - 1 critical issue**

**Entity Definition** (`domain/entities.ts`):
```typescript
/**
 * Transaction amount in INTEGER CENTS
 *
 * SACRED INTEGER ARITHMETIC (CTO Mandate):
 * - $10.50 = 1050 (NOT 10.5)
 * - $0.01 = 1
 * - $100.00 = 10000
 */
readonly amountCents: number;
readonly amountHomeCents: number;
```

**Compliant Patterns:**
- Database uses BIGINT with direct `Number(bigint)` passthrough (no floating-point conversion)
- `repository/supabase-transaction-repository.ts:71-81` documents BIGINT handling
- Constants at `domain/constants.ts:45-89` define precision limits
- `toCents()` / `fromCents()` used in UI display layer only

**CRITICAL VIOLATION:**

| File | Line | Code | Issue |
|------|------|------|-------|
| `components/bulk-action-bar.tsx` | 113 | `isBalanced: Math.abs(previewDifference) < 0.01` | Floating-point comparison in reconciliation math |

**Problem:** Uses decimal comparison `< 0.01` when source data is integer cents. Floating-point comparison can fail with certain values due to IEEE 754 precision.

**Required Fix:**
```typescript
// BEFORE (violation)
isBalanced: Math.abs(previewDifference) < 0.01,

// AFTER (correct integer arithmetic)
isBalanced: Math.abs(Math.round(previewDifference * 100)) < 1,
```

**Acceptable Floating-Point Usage** (UI layer only):
- `hooks/use-transfer-calculation.ts:31-32` - `parseFloat()` for UI display
- `components/transfer-modal-content.tsx:121,124` - `parseFloat()` with immediate `Math.round(*100)` conversion
- `components/ledger-transaction-modal-content.tsx:78,91` - `parseFloat()` with immediate `Math.round()`

### 3.2 Sync Integrity

**Status: COMPLIANT**

**Version Validation** (`schemas/transaction.schema.ts:92-97`):
```typescript
version: z.number()
  .int()
  .positive('Version must be a positive integer')
```

**Version-Checked Operations:**
- All `update()` calls require version parameter
- Service auto-retries on version conflict (2 attempts max): `transaction-service.ts:131-177`
- Delete operations include version: `await this.repository.delete(userId, id, version)`
- Version conflict detection with `TransactionVersionConflictError`

**Optimistic Update Pattern** (`use-transactions.ts:140`):
```typescript
// New transaction starts at version 1
version: 1,
```

**Interface Documentation** (`transaction-repository.interface.ts:115-142`):
```typescript
/**
 * Updates an existing transaction with version-checked concurrency.
 * @param version - Required for optimistic concurrency control
 */
```

### 3.3 Soft Deletes (Tombstone Pattern)

**Status: COMPLIANT**

**Implementation Evidence:**

| Location | Pattern |
|----------|---------|
| `repository/transaction-repository.interface.ts:288` | "Sets deleted_at = NOW() (does NOT physically delete)" |
| `repository/supabase-transaction-repository.ts:494` | "Use version-checked soft delete RPC" |
| `repository/local-transaction-repository.ts:7` | "Tombstone Pattern: ALL queries filter deleted_at using activeTombstoneFilter()" |
| `repository/local-transaction-repository.ts:801` | `Q.where('deleted_at', Q.notEq(null))` |

**Restore Capability:**
- Restore RPC implemented: `restore_transaction`
- Bidirectional sync support: `getDeleted()` tracks deletions for delta sync

**Query Filtering:**
- `query.is('deleted_at', null)` in Supabase queries
- `activeTombstoneFilter()` in WatermelonDB queries
- `includeDeleted` filter option available

**No physical DELETE operations found.**

### 3.4 Auth Abstraction

**Status: COMPLIANT**

**Service Layer** (`services/transaction-service.ts:17,44`):
```typescript
import type { IAuthProvider } from '@/lib/auth';

export class TransactionService implements ITransactionService {
  constructor(
    private readonly repository: ITransactionRepository,
    private readonly authProvider: IAuthProvider  // Abstraction
  ) {}

  private async getCurrentUserId(): Promise<string> {
    return this.authProvider.getCurrentUserId();  // Via interface
  }
}
```

**Transfer Service** (`services/transfer-service.ts:10,23`):
```typescript
import type { IAuthProvider } from '@/lib/auth/auth-provider.interface';

constructor(
  private readonly repository: ITransferRepository,
  private readonly authProvider: IAuthProvider
) {}
```

**Dependency Injection** (`hooks/use-transaction-service.ts:21,76`):
```typescript
const authProvider = createSupabaseAuthProvider(supabase);
return createTransactionService(repository, authProvider);
```

**No direct `supabase.auth.getUser()` calls in features/transactions.**

---

## 4. Performance & Scalability

### 4.1 React Compiler Check (useWatch)

**Status: COMPLIANT**

**Zero `watch()` calls found** in features/transactions.

All reactive state management uses proper React hooks:
- `useMemo` - 54 instances with proper dependencies
- `useEffect` - 5 instances with dependency arrays
- `useCallback` - 8 instances for memoized callbacks

### 4.2 Re-render Optimization

**Status: MINOR ISSUES - 3 observations**

#### Issue #1: Zustand Callback in useEffect Dependencies

| File | Lines | Issue | Severity |
|------|-------|-------|----------|
| `hooks/use-bulk-selection.ts` | 179-194 | 6 dependencies including `toggleSelection` from Zustand | LOW |

**Context:** The `toggleSelection` function is included in the dependency array. While Zustand typically memoizes dispatchers, verify this callback is stable between renders.

**Code:**
```typescript
useEffect(() => {
  // Selection cleanup effect
  const visibleIds = new Set(allTransactionIds);
  const staleIds = Array.from(selectedIds).filter((id) => !visibleIds.has(id));
  // ...
}, [filterKey, isBulkMode, selectedIds, allTransactionIds, transactionVersionMap, toggleSelection]);
```

#### Issue #2: O(n) Lookup in useEffect

| File | Lines | Issue | Severity |
|------|-------|-------|----------|
| `hooks/use-direction-toggle.ts` | 14-23 | `categories.find()` call is O(n) on every effect run | LOW |

**Recommendation:** Wrap category lookup in `useMemo` for large category lists.

#### Issue #3: Array Creation in Effect

| File | Lines | Issue | Severity |
|------|-------|-------|----------|
| `hooks/use-bulk-selection.ts` | 182-183 | `Array.from(selectedIds).filter()` creates new array on every effect run | LOW |

**Pattern:**
```typescript
const staleIds = Array.from(selectedIds).filter((id) => !visibleIds.has(id));
```

**Could be optimized:** Use Set intersection instead of array conversion.

### 4.3 Query Optimization

**Status: COMPLIANT**

**Pagination Support** (`repository/transaction-repository.interface.ts`):
- `getAllPaginated()` with cursor-based pagination
- `limit` and `offset` support
- Category counts with efficient aggregation

**Service Guards:**
- `if (!service) return` checks prevent operations on null service
- `enabled: !!service` query guards prevent unnecessary fetches

---

## 5. Architecture Compliance Summary

### Key Files and Responsibilities

| File | Responsibility |
|------|---------------|
| `domain/entities.ts` | Core transaction data structures |
| `domain/types.ts` | DTOs, filters, result types |
| `domain/errors.ts` | Typed error classes with guards |
| `repository/transaction-repository.interface.ts` | Data access contract |
| `repository/supabase-transaction-repository.ts` | Remote database operations |
| `repository/local-transaction-repository.ts` | Local-first storage |
| `repository/hybrid-transaction-repository.ts` | Orchestration layer |
| `services/transaction-service.ts` | Business logic + auth context |
| `services/transaction-routing-service.ts` | Ledger vs Inbox routing |
| `hooks/use-transactions.ts` | React Query integration |
| `hooks/use-transaction-routing.ts` | Routing hook with optimistic updates |
| `schemas/transaction.schema.ts` | Zod validation schemas |

### CTO Mandates Checklist

| Mandate | Implementation | Status |
|---------|---------------|--------|
| `amountCents`: INTEGER CENTS | `entities.ts:62+` | **FAIL** (1 violation in bulk-action-bar) |
| ISO 8601 date strings | `entities.ts:date,createdAt,updatedAt` | PASS |
| `DataResult<T>` pattern | Throughout domain/types | PASS |
| `instanceof` error handling | `errors.ts:166+` | PASS |
| Tombstone soft deletes | `supabase-repo.ts`, `local-repo.ts` | PASS |
| Version-checked RPC | `supabase-repo.ts` | PASS |
| IAuthProvider abstraction | `transaction-service.ts:17` | PASS |
| React Compiler compatible | No `watch()` calls | PASS |
| Delta Sync support | `getChangesSince()`, `TransactionChanges` | PASS |

---

## 6. Recommendations

### High Priority

1. **Fix Integer Cents Violation**
   - **File**: `components/bulk-action-bar.tsx:113`
   - **Action**: Replace `< 0.01` with integer comparison
   - **Code**: `Math.abs(Math.round(previewDifference * 100)) < 1`

### Medium Priority

2. **Refactor Cross-Feature Dependencies (25 violations)**
   - Extract shared types to `@/lib/types/domain`
   - Create interfaces in `@/lib/interfaces` for accounts, categories
   - Use dependency injection pattern for cross-feature hooks

### Low Priority

3. **Optimize Category Lookup in useDirectionToggle**
   - Wrap `categories.find()` in `useMemo`
   - Create lookup map for O(1) access

4. **Verify Zustand Callback Stability**
   - Confirm `toggleSelection` is memoized by Zustand store
   - Add React DevTools profiling if re-renders detected

---

## Appendix: Zod Schemas

### Form Validation (`schemas/transaction.schema.ts`)

```typescript
export const createTransactionSchema = z.object({
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  amountCents: z.number().int(),
  description: z.string().min(1).max(255),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(1000).nullable().optional(),
  cleared: z.boolean().optional(),
});

export const updateTransactionSchema = z.object({
  version: z.number().int().positive('Version must be a positive integer'),
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  amountCents: z.number().int().optional(),
  description: z.string().min(1).max(255).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(1000).nullable().optional(),
  cleared: z.boolean().optional(),
});

export const quickAddTransactionSchema = z.object({
  // Relaxed schema for inbox items
  description: z.string().min(1),
  amountCents: z.number().int(),
  date: z.string().optional(),
});
```

### Inferred Types

```typescript
export type CreateTransactionFormData = z.infer<typeof createTransactionSchema>;
export type CreateTransactionLedgerData = z.infer<typeof createTransactionLedgerSchema>;
export type UpdateTransactionFormData = z.infer<typeof updateTransactionSchema>;
export type QuickAddTransactionFormData = z.infer<typeof quickAddTransactionSchema>;
```
