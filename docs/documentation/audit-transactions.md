# Composable Manifest: features/transactions

> **Generated**: 2026-01-30
> **Auditor**: Senior Systems Architect & Security Auditor
> **Scope**: `/features/transactions/` folder
> **Previous Audit**: 2026-01-28

---

## Executive Summary

| Category | Status | Issues | Change |
|----------|--------|--------|--------|
| Entity Registry | COMPLIANT | 0 | — |
| Naming Conventions | COMPLIANT | 0 | — |
| Type Safety | **WARNING** | 2 | NEW |
| Dependency Manifest | **VIOLATION** | 21 | ↓4 |
| Integer Cents | COMPLIANT | 0 | ✅ FIXED |
| Sync Integrity | COMPLIANT | 0 | — |
| Soft Deletes | COMPLIANT | 0 | — |
| Auth Abstraction | COMPLIANT | 0 | — |
| React Compiler | COMPLIANT | 0 | — |
| Re-render Optimization | **WARNING** | 3 | NEW |

**Overall**: 26 → 26 issues (4 feature bleed fixed, 2 type safety issues found, 3 performance warnings added)

**Key Improvements Since Last Audit:**
- ✅ Integer cents floating-point comparison FIXED
- ✅ Feature bleed reduced from 25 → 21 imports
- ✅ IoC pattern implemented for inbox integration

---

## 1. Variable & Entity Registry

### 1.1 Directory Structure

```
features/transactions/
├── api/                              (1 file)
│   └── filters.ts
├── components/                       (15 files)
│   ├── add-transaction-modal.tsx
│   ├── all-transactions-table.tsx
│   ├── bulk-action-bar.tsx
│   ├── category-selector.tsx
│   ├── ledger-transaction-modal-content.tsx
│   ├── monthly-spending-table.tsx
│   ├── transaction-detail-panel.tsx
│   ├── transaction-form.tsx
│   ├── transaction-info.tsx
│   ├── transaction-list.tsx
│   ├── transaction-row.tsx
│   ├── transfer-form.tsx
│   ├── transfer-modal-content.tsx
│   └── ... (2 more)
├── domain/                           (5 files)
│   ├── entities.ts
│   ├── types.ts
│   ├── errors.ts
│   ├── constants.ts
│   └── index.ts
├── hooks/                            (12 files)
│   ├── use-bulk-selection.ts
│   ├── use-direction-toggle.ts
│   ├── use-monthly-spending.ts
│   ├── use-transaction-filters.ts
│   ├── use-transaction-routing.ts
│   ├── use-transaction-service.ts
│   ├── use-transaction-update.ts
│   ├── use-transactions.ts
│   ├── use-transfer-calculation.ts
│   ├── use-transfer-resolution.ts
│   ├── use-transfer-service.ts
│   └── use-transfers.ts
├── repository/                       (7 files)
│   ├── transaction-repository.interface.ts
│   ├── transfer-repository.interface.ts
│   ├── supabase-transaction-repository.ts
│   ├── supabase-transfer-repository.ts
│   ├── local-transaction-repository.ts
│   ├── hybrid-transaction-repository.ts
│   └── index.ts
├── services/                         (8 files)
│   ├── transaction-service.interface.ts
│   ├── transaction-service.ts
│   ├── transfer-service.interface.ts
│   ├── transfer-service.ts
│   ├── transaction-routing-service.interface.ts
│   ├── transaction-routing-service.ts
│   ├── __tests__/
│   └── index.ts
├── schemas/                          (1 file)
│   └── transaction.schema.ts
├── stores/                           (1 file)
│   └── transaction-selection-store.ts
└── index.ts
```

**Total: 56 TypeScript/TSX files**

### 1.2 Entity Inventory

#### Entities (`domain/entities.ts`)

| Entity | Lines | Description |
|--------|-------|-------------|
| `TransactionEntity` | 62-231 | Core transaction with integer cents, version, tombstone. All readonly properties. |
| `TransactionViewEntity` | 282-331 | Enriched read model with joined account/category data. Union types for categoryType and reconciliationStatus. |

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
  readonly categoryType: 'income' | 'expense' | 'opening_balance' | null;
  readonly reconciliationStatus: 'draft' | 'completed' | null;
}
```

**Type Guards Provided:**
- `isTransactionViewEntity()` - Line 336-340: Checks for 'accountName' in entity
- `isDeletedTransaction()` - Line 345-349: Checks deletedAt !== null
- `isTransferTransaction()` - Line 354-358: Checks transferId !== null
- `isReconciledTransaction()` - Line 363-367: Checks cleared property

#### DTOs (`domain/types.ts`)

| DTO | Lines | Purpose |
|-----|-------|---------|
| `DataResult<T>` | 43 | Generic type alias to `SharedDataResult<T, TransactionError>` |
| `CreateTransactionDTO` | 72-131 | Input for creating new transactions (all readonly) |
| `UpdateTransactionDTO` | 155-172 | Partial update with version requirement |
| `BulkUpdateTransactionDTO` | 188-200 | Batch update (max 100 transactions) |
| `BulkUpdateResult` | 208-223 | Response with success/failure counts |
| `CreateTransferDTO` | 248-281 | Atomic transfer creation (2 linked transactions) |
| `TransferResult` | 289-304 | Response with transferId and both transaction entities |
| `TransactionFilters` | 328-370 | Query filters (supports multiple categories) |
| `TransactionChanges` | 390-404 | Delta sync response (created/updated/deleted arrays) |
| `CategoryCounts` | 412-414 | Index signature for aggregated counts |
| `TransactionRoute` | 427 | Type alias: `'ledger' | 'inbox'` |
| `TransactionRequiredField` | 435 | Type alias for routing UI highlighting |
| `TransactionRouteInputDTO` | 461-513 | Smart routing input (0 and null treated as MISSING) |
| `RoutingDecision` | 531-562 | Result from determineRoute() |
| `SubmissionResult` | 582-613 | Result from submitTransaction() |
| `UpdateRouteInputDTO` | 634-660 | Update with routing (detects promotion/demotion) |
| `UpdateResult` | 684-734 | Update response with promotion/demotion flags |

#### Interfaces

| Interface | File | Lines | Methods | Purpose |
|-----------|------|-------|---------|---------|
| `ITransactionRepository` | `repository/transaction-repository.interface.ts` | 56-419 | 12 | Data access contract |
| `ITransactionService` | `services/transaction-service.interface.ts` | 51-206 | 10 | Business logic (no userId param - auth extracted) |
| `ITransferRepository` | `repository/transfer-repository.interface.ts` | 33-48 | 1 | Transfer-specific repository |
| `ITransferService` | `services/transfer-service.interface.ts` | 19-28 | 1 | Transfer service contract |
| `ITransactionRoutingService` | `services/transaction-routing-service.interface.ts` | 52-204 | 3 | Ledger vs Inbox routing engine |

**Repository Methods (ITransactionRepository):**
- `getAllPaginated()` - Paginated transactions with filtering
- `getById()` - Single transaction by ID
- `getCategoryCounts()` - Aggregated category counts
- `create()` - New transaction (returns full entity)
- `update()` - Version-checked update
- `updateBatch()` - Partial updates
- `bulkUpdate()` - Batch update (max 100)
- `delete()` - Soft delete (sets deleted_at)
- `restore()` - Undo soft delete
- `getDeleted()` - Tombstones for delta sync
- `getChangesSince()` - Full delta sync
- `permanentlyDelete()` - Admin physical DELETE

#### Error Classes (`domain/errors.ts`)

| Error | Code | Lines | Purpose |
|-------|------|-------|---------|
| `TransactionError` | Base | 35-43 | Parent class (message + code) |
| `TransactionNotFoundError` | `NOT_FOUND` | 50-55 | Transaction ID not found |
| `TransactionVersionConflictError` | `VERSION_CONFLICT` | 69-80 | Optimistic concurrency failure |
| `TransactionValidationError` | `VALIDATION_ERROR` | 93-102 | Data validation failure (optional field) |
| `TransactionAuthenticationError` | `AUTHENTICATION_ERROR` | 109-114 | Auth failure |
| `TransactionRepositoryError` | `REPOSITORY_ERROR` | 126-134 | Database/network error |
| `UnexpectedTransactionError` | `UNEXPECTED_ERROR` | 141-149 | Catch-all wrapper |
| `TransactionDeletedError` | `DELETED` | 156-161 | Operation on soft-deleted |
| `TransferRepositoryError` | N/A | transfer-repository.interface.ts:26 | Transfer-specific |

**Type Guards:**
- `isTransactionError()` - Line 166-168
- `isVersionConflictError()` - Line 173-177
- `isValidationError()` - Line 182-184

#### Constants (`domain/constants.ts`)

| Constant | Lines | Values |
|----------|-------|--------|
| `TRANSACTION_VALIDATION` | 36-90 | `DESCRIPTION_MAX_LENGTH: 255`, `NOTES_MAX_LENGTH: 1000`, `MAX_AMOUNT_CENTS: 9999999999`, `MIN_AMOUNT_CENTS: -9999999999`, `DATE_FORMAT`, `EXCHANGE_RATE_PRECISION: 6` |
| `TRANSACTION_ERRORS` | 102-137 | Error message templates with interpolation |
| `TRANSACTION_LIMITS` | 144-153 | `BULK_UPDATE_MAX_SIZE: 100`, `MAX_FETCH_SIZE: 1000`, `DEFAULT_PAGE_SIZE: 50` |

### 1.3 Naming Audit

**Status: COMPLIANT** ✓

**Comprehensive Check - All 40+ domain properties verified:**

| Context | Convention | Examples |
|---------|------------|----------|
| Domain Objects | camelCase | `amountCents`, `amountHomeCents`, `currencyOriginal`, `exchangeRate`, `accountId`, `categoryId`, `transferId`, `createdAt`, `updatedAt`, `deletedAt`, `transactionId`, `userId`, `isComplete`, `hasAnyData`, `missingFields` |
| Database Rows | snake_case | `amount_original`, `amount_home`, `account_id`, `category_id`, `currency_code`, `created_at`, `updated_at`, `deleted_at`, `transfer_id`, `exchange_rate`, `source_text`, `inbox_id` |

**Transformation Functions:**
- `dbTransactionViewToDomain()` - `lib/data/data-transformers.ts`
- `dbTransactionViewsToDomain()` - Array transformation
- `localTransactionViewsToDomain()` - `lib/data/local-data-transformers.ts`

**Result: PERFECT - No naming violations detected**

### 1.4 Type Safety Audit

**Status: WARNING - 2 HIGH-RISK issues**

#### Summary

| Check | Count | Status |
|-------|-------|--------|
| `as any` usage | 15 | 13 justified, 2 HIGH-RISK |
| `as unknown` usage | 12 | All justified |
| Naked types | 0 | None found |
| Zod validation | Complete | All boundaries protected |

#### `any` Usage Analysis

**Justified (SDK Limitations):**

| File | Lines | Context | Reason |
|------|-------|---------|--------|
| `api/filters.ts` | 55, 85 | `query as any` | Supabase query builder generic limitation |
| `repository/supabase-transaction-repository.ts` | 89, 91 | `applyFilters(query: any)` | Supabase SDK returns untyped builder |
| `hooks/use-transactions.ts` | 176, 203, 206, 220, 309, 314, 325, 333, 336, 353, 418, 423, 440, 443, 458 | `(old: any) =>` | React Query cache manipulation |
| `hooks/use-transaction-routing.ts` | 185, 222 | `(old: any) =>` | React Query internal type |

**HIGH-RISK (Needs Fix):**

| File | Lines | Code | Issue | Severity |
|------|-------|------|-------|----------|
| `repository/local-transaction-repository.ts` | 686, 699, 988 | `undefined as any` | Forces undefined to match void return | HIGH |
| `repository/supabase-transaction-repository.ts` | 543 | `undefined as any` | Same pattern | HIGH |

**Recommended Fix:**
```typescript
// CURRENT (WRONG):
return { success: true, data: undefined as any, buffered: true };

// SHOULD BE:
type BufferedDeleteResult = { success: true; buffered: true };
return { success: true, data: undefined, buffered: true } as DataResult<void> & { buffered: true };
```

#### `unknown` Usage (All Justified)

| File | Lines | Context |
|------|-------|---------|
| `domain/errors.ts` | 129, 144 | `originalError?: unknown` - Proper error wrapping |
| `domain/errors.ts` | 166, 174, 182 | Type guard parameters |
| `hooks/use-transaction-routing.ts` | 109, 110, 175, 212 | Optimistic update snapshots for rollback |
| `repository/supabase-transfer-repository.ts` | 26 | Custom error cause |
| `hooks/use-transactions.ts` | 537 | Generic constraint for mutation context |

#### Validation Chain (No Naked Types)

1. Supabase returns data
2. `validateArrayOrThrow(TransactionsViewRowSchema, data)` validates at boundary
3. `dbTransactionViewsToDomain()` transforms with explicit type checking
4. Domain entities have all readonly properties

---

## 2. Dependency Manifest (Import Audit)

### 2.1 Feature Bleed Check

**Status: VIOLATION - 21 cross-feature imports across 13 files** (↓4 from previous audit)

#### Summary by Dependency

| Dependency | Count | Severity | Change |
|------------|-------|----------|--------|
| `@/features/accounts` | 5 | MODERATE | ↓1 |
| `@/features/categories` | 5 | MODERATE | — |
| `@/features/inbox` | 2 | CRITICAL (IoC mitigated) | ↓3 |
| `@/features/reconciliations` | 2 | CRITICAL | — |
| `@/features/shared` | 2 | ACCEPTABLE | +1 |
| `@/features/settings` | 1 | LOW | — |
| `@/features/groupings` | 1 | LOW | — |
| **Total** | **21** | | **↓4** |

#### Detailed Violation List

**Accounts Feature (5 imports - MODERATE):**

| File | Import |
|------|--------|
| `components/transaction-detail-panel.tsx:12` | `@/features/accounts/domain` |
| `components/ledger-transaction-modal-content.tsx:33` | `@/features/accounts/hooks/use-accounts` |
| `components/all-transactions-table.tsx:32` | `@/features/accounts/hooks/use-accounts` |
| `hooks/use-transfers.ts:16` | `@/features/accounts/domain` |
| `hooks/use-transfer-resolution.ts:3` | `@/features/accounts/hooks/use-accounts` |

**Categories Feature (5 imports - MODERATE):**

| File | Import |
|------|--------|
| `components/transaction-detail-panel.tsx:13` | `@/features/categories/domain` |
| `components/ledger-transaction-modal-content.tsx:32` | `@/features/categories/hooks/use-categories` |
| `components/all-transactions-table.tsx:30` | `@/features/categories/hooks/use-leaf-categories` |
| `components/bulk-action-bar.tsx:8` | `@/features/categories/hooks/use-leaf-categories` |
| `hooks/use-direction-toggle.ts:2` | `@/features/categories/hooks/use-categories` |

**Inbox Feature (2 imports - CRITICAL but IoC Mitigated):**

| File | Import | Notes |
|------|--------|-------|
| `domain/types.ts:22` | `import type { InboxItemViewEntity }` | Type-only import |
| `services/__tests__/transaction-routing-service.test.ts:16` | `import type { InboxService }` | Test mock only |

**IoC Pattern Implementation:**
```typescript
// @/domain/inbox (external interface - NOT a feature import)
export interface IInboxOperations {
  create(...): Promise<DataResult<InboxItemViewEntity>>;
  update(...): Promise<DataResult<InboxItemViewEntity>>;
  delete(...): Promise<DataResult<void>>;
}

// transaction-routing-service.ts - DEPENDS ON INTERFACE, NOT IMPLEMENTATION
export class TransactionRoutingService implements ITransactionRoutingService {
  constructor(
    private readonly transactionService: ITransactionService,
    private readonly inboxOperations: IInboxOperations  // Interface injection
  ) {}
}
```

**Reconciliations Feature (2 imports - CRITICAL):**

| File | Import |
|------|--------|
| `components/bulk-action-bar.tsx:10` | `@/features/reconciliations/hooks/use-reconciliations` |
| `hooks/use-bulk-selection.ts:27` | `@/features/reconciliations/hooks/use-reconciliations` |

**Other Features (4 imports - LOW/ACCEPTABLE):**

| File | Import | Severity |
|------|--------|----------|
| `components/transaction-detail-panel.tsx:5-6` | `@/features/shared` | ACCEPTABLE |
| `components/all-transactions-table.tsx:33` | `@/features/settings/hooks/use-user-settings` | LOW |
| `hooks/use-transaction-filters.ts:19` | `@/features/groupings/hooks/use-groupings` | LOW |

### 2.2 Import Inventory

| Category | Count | Examples |
|----------|-------|----------|
| React/External | 72 | react(23), lucide-react(14), date-fns(9), sonner(5), @tanstack/react-query(5) |
| Lib (`@/lib/*`) | 57 | constants(11), utils(10), hooks(7), supabase/client(3), data-transformers(1) |
| UI Components | 22 | button, calendar, input, select, checkbox, card, sheet, dialog |
| Domain (`@/domain/*`) | 3 | inbox interface (IInboxOperations) |
| Internal Feature | 28 | domain(12), hooks(9), services(3), repository(3), components(1) |
| Stores | 1 | transaction-selection-store |

### 2.3 Transformer Usage

**Status: COMPLIANT** ✓ **ZERO inline mapping logic**

| Repository | Transformer | Location |
|------------|-------------|----------|
| `supabase-transaction-repository.ts:48-50` | `dbTransactionViewToDomain`, `dbTransactionViewsToDomain` | `@/lib/data/data-transformers` |
| `supabase-transaction-repository.ts:83` | Comment: "Transformer logic moved to shared data-transformers.ts" | Documented |
| `supabase-transaction-repository.ts:187, 232, 619` | `sharedDbTransactionViewsToDomain()` | Applied at boundary |
| `local-transaction-repository.ts:56` | `localTransactionViewsToDomain` | `@/lib/data/local-data-transformers` |

**Validation Pattern:**
```typescript
return {
  success: true,
  data: sharedDbTransactionViewsToDomain(
    validateArrayOrThrow(TransactionsViewRowSchema, data)
  )
};
```

### 2.4 Direct Supabase Usage

**Status: COMPLIANT** ✓ **Repository layer only**

**Acceptable (repository layer):**
- `repository/supabase-transaction-repository.ts` - Implementation
- `repository/supabase-transfer-repository.ts` - Implementation
- `repository/index.ts` - Factory pattern

**Acceptable (hook initialization):**
- `hooks/use-transaction-service.ts:20` - `createClient()` for DI
- `hooks/use-transfer-service.ts:11` - `createClient()` for DI

**No violations:** Components and services do not import Supabase client directly.

---

## 3. Sacred Mandate Compliance

### 3.1 Integer Cents

**Status: COMPLIANT** ✅ (FIXED since last audit)

**Entity Definition** (`domain/entities.ts:62+`):
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

**Compliant Patterns Verified:**

| File | Lines | Pattern | Status |
|------|-------|---------|--------|
| `components/ledger-transaction-modal-content.tsx` | 78-80 | `parseFloat()` → `Math.round(amountVal * 100)` | ✅ |
| `components/transfer-modal-content.tsx` | 121-130 | `parseFloat()` → `Math.round(sent * 100)` | ✅ |
| `repository/local-transaction-repository.ts` | 396-397 | `Math.round(data.amountCents)` | ✅ |
| `repository/local-transaction-repository.ts` | 520, 537, 554-555 | `Math.round()` in all write operations | ✅ |
| `hooks/use-transactions.ts` | 209, 212, 341, 344, 446, 449 | `toCents()` / `fromCents()` for balance | ✅ |

**Display-Only Patterns (Acceptable):**

| File | Lines | Pattern | Notes |
|------|-------|---------|-------|
| `components/bulk-action-bar.tsx` | 111-114 | `Math.round(... * 100) / 100` | Preview display only, NOT stored |
| `components/transaction-info.tsx` | 288 | `exchangeRate.toFixed(6)` | Display formatting only |

**No Floating-Point Comparisons Found:**
- ✅ No `=== 0.0` comparisons
- ✅ No `< 0.01` comparisons
- ✅ No `> 0.01` comparisons

### 3.2 Sync Integrity (Version Bumps)

**Status: COMPLIANT** ✓

**Version Validation** (`schemas/transaction.schema.ts:93-97`):
```typescript
version: z
  .number()
  .int()
  .positive('Version must be a positive integer'),
```

**Service Layer Auto-Retry** (`transaction-service.ts:131-177`):
```typescript
// Line 141: Check for version conflict
if (!result.success && result.conflict) {
  // Lines 143-146: Fetch fresh version
  const freshEntity = await this.repository.getById(userId, id);
  // Lines 151-154: Retry with latest version
  const retryData = { ...data, version: freshEntity.data.version };
  // Lines 156-160: Max 2 attempts
}
```

**Repository Version Checks:**

| File | Lines | Operation |
|------|-------|-----------|
| `local-transaction-repository.ts` | 495 | `if (transaction.version !== data.version)` → conflict |
| `local-transaction-repository.ts` | 668 | Delete version check |
| `local-transaction-repository.ts` | 792-827 | `getDeleted()` with sinceVersion filtering |
| `local-transaction-repository.ts` | 833-887 | `getChangesSince()` delta sync |

**Optimistic Update Pattern** (`use-transactions.ts:140`):
```typescript
version: 1, // New transaction starts at version 1
```

### 3.3 Soft Deletes (Tombstone Pattern)

**Status: COMPLIANT** ✓

**CTO Mandates Documentation** (`local-transaction-repository.ts:6-10`):
```typescript
* CTO MANDATES:
* - Tombstone Pattern: ALL queries filter deleted_at using activeTombstoneFilter()
* - ID Generation Ownership: Repository generates UUIDs via generateEntityId()
* - Integer Cents: All amounts are integers (Math.round in toDomainEntity)
* - Sync Status State Machine: All writes start as 'pending'
* - No N+1 Queries: enrichWithJoinedData uses batch queries
```

**Soft Delete Implementation:**

| Location | Pattern |
|----------|---------|
| `local-transaction-repository.ts:689-695` | `record.deletedAt = Date.now();` |
| `local-transaction-repository.ts:764-769` | Restore: `record.deletedAt = null;` |
| `local-transaction-repository.ts:212` | Query: `activeTombstoneFilter()` |
| `local-transaction-repository.ts:309` | getCategoryCounts: `activeTombstoneFilter()` |
| `local-transaction-repository.ts:801` | getDeleted: `Q.where('deleted_at', Q.notEq(null))` |

**Delta Sync Support:**
- `getDeleted(userId, sinceVersion?)` - Returns tombstones for sync
- `getChangesSince(userId, sinceVersion)` - Separates created/updated/deleted

**No Physical DELETE Operations Found** ✓

### 3.4 Auth Abstraction

**Status: COMPLIANT** ✓

**Service Layer** (`services/transaction-service.ts:17,44,60`):
```typescript
import type { IAuthProvider } from '@/lib/auth';

export class TransactionService implements ITransactionService {
  constructor(
    private readonly repository: ITransactionRepository,
    private readonly authProvider: IAuthProvider
  ) {}

  private async getCurrentUserId(): Promise<string> {
    return this.authProvider.getCurrentUserId();
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

**Hook-Level DI** (`hooks/use-transaction-service.ts:76`, `hooks/use-transfer-service.ts:39`):
```typescript
const authProvider = createSupabaseAuthProvider(supabase);
return createTransactionService(repository, authProvider);
```

**No direct `supabase.auth.getUser()` calls in features/transactions** ✓

---

## 4. Performance & Scalability

### 4.1 React Compiler Check

**Status: COMPLIANT** ✓

**Zero `watch()` calls from react-hook-form found**

All form subscriptions use controlled component pattern:
- `components/transaction-form.tsx:47-49` - `onChange` callback pattern
- `components/transfer-form.tsx:44-52` - `useTransferResolution` hook + single `useEffect`

**React Compiler Compatibility: FULLY COMPLIANT**

### 4.2 Re-render Optimization

**Status: WARNING - 3 issues**

#### useEffect Hooks Analysis

| File | Lines | Dependencies | Status | Issue |
|------|-------|--------------|--------|-------|
| `components/transaction-list.tsx` | 152 | `[isMobile, virtualizer]` | ⚠️ | `virtualizer` is mutable object |
| `components/transaction-list.tsx` | 160 | `[lastVirtualItem, ...]` | ⚠️ | `lastVirtualItem` mutable reference |
| `components/transaction-list.tsx` | 174 | `[scrollToIndex, virtualizer]` | ⚠️ | `virtualizer` mutable |
| `components/all-transactions-table.tsx` | 58 | `[userSettings?.transactionSortPreference]` | ✅ | Properly scoped |
| `components/transfer-form.tsx` | 48-52 | `[resolution.suggestions, onChange]` | ✅ | CTO compliant single effect |
| `hooks/use-bulk-selection.ts` | 179 | 6 dependencies with `filterKey` | ✅ | Uses filterKey not JSON.stringify |

**Issue #1: useVirtualizer Object Instability**

| File | Lines | Issue | Severity |
|------|-------|-------|----------|
| `components/transaction-list.tsx` | 152, 160, 174 | `virtualizer` object in dependencies | MEDIUM |

**Recommendation:** Use stable key or useRef pattern for virtualizer object.

#### useMemo Hooks Analysis

**21+ useMemo implementations verified - All correct:**

| File | Line | Dependencies | Status |
|------|------|--------------|--------|
| `hooks/use-transaction-routing.ts` | 162 | `[transactionService, inboxOperations]` | ✅ |
| `hooks/use-transfer-resolution.ts` | 65 | 8 granular deps | ✅ |
| `hooks/use-bulk-selection.ts` | 146, 155, 161, 166 | Proper granular deps | ✅ |
| `hooks/use-transaction-filters.ts` | 111, 125, 135, 147 | Correct merge logic | ✅ |
| `components/transfer-modal-content.tsx` | 87 | `[formData]` | ✅ |
| `components/ledger-transaction-modal-content.tsx` | 124, 125 | `[formData]`, `[determineRoute, dto]` | ✅ |
| `components/transaction-detail-panel.tsx` | 57, 77, 93 | Correct single deps | ✅ |

#### useCallback Hooks Analysis

**22+ useCallback implementations verified - All correct with complete, minimal dependencies:**

| File | Lines | Dependencies | Status |
|------|-------|--------------|--------|
| `hooks/use-transaction-routing.ts` | 174, 211, 246 | `[queryClient]` | ✅ Minimal |
| `hooks/use-transaction-routing.ts` | 274 | 6 callback deps | ✅ Complete |
| `hooks/use-transaction-routing.ts` | 337 | `[routingService]` | ✅ Minimal |
| `hooks/use-bulk-selection.ts` | 199, 215, 253 | Complete deps | ✅ |
| `hooks/use-transaction-filters.ts` | 156 | `[]` | ✅ Correctly stable |
| `components/all-transactions-table.tsx` | 145 | `[]` | ✅ Correctly stable |
| `components/transfer-modal-content.tsx` | 112, 117 | Correct deps | ✅ |
| `components/ledger-transaction-modal-content.tsx` | 131, 136 | Correct deps | ✅ |
| `components/transaction-list.tsx` | 186, 209 | Correct deps | ✅ |
| `components/transaction-detail-panel.tsx` | 120, 190 | Correct deps | ✅ |

### 4.3 Query Patterns

**Status: COMPLIANT** ✓

**No N+1 Query Issues:**
- `useTransactions()` - Single infinite query with pagination
- `useCategoryCounts()` - Single aggregation query
- Batch queries in `enrichWithJoinedData()`:
```typescript
// local-transaction-repository.ts:100-112
const accounts = await this.database
  .get<AccountModel>('bank_accounts')
  .query(Q.where('id', Q.oneOf(accountIds)))
  .fetch();

const categories = categoryIds.length > 0
  ? await this.database
      .get<CategoryModel>('categories')
      .query(Q.where('id', Q.oneOf(categoryIds)))
      .fetch()
  : [];
```

**Query Guards (Orchestrator Rule):**

| Hook | Guard | Status |
|------|-------|--------|
| `use-transactions.ts:63` | `enabled: !!service` | ✅ |
| `use-transactions.ts:93` | `enabled: !!id && !!service` | ✅ |
| `use-transactions.ts:638` | `enabled: !!service` | ✅ |

### 4.4 Component Memoization

**Status: EXCELLENT** ✓

| Component | File | Memoization | Purpose |
|-----------|------|-------------|---------|
| `TransactionRow` | `transaction-row.tsx:92` | `React.memo` + custom comparator | Virtualized 1000+ item list |
| `TransferModalContent` | `transfer-modal-content.tsx:72` | `React.memo` | Prevent re-renders during typing |
| `LedgerTransactionModalContent` | `ledger-transaction-modal-content.tsx:100` | `React.memo` | Prevent re-renders during typing |

**TransactionRow Custom Comparator (lines 225-231):**
```typescript
(prevProps, nextProps) =>
  prevProps.transaction.id === nextProps.transaction.id &&
  prevProps.isSelected === nextProps.isSelected &&
  prevProps.isFocused === nextProps.isFocused &&
  prevProps.isBulkMode === nextProps.isBulkMode
```

### 4.5 Optimistic Updates

**Status: EXCELLENT** ✓

All mutations use `onMutate` pattern for zero-latency UX:
- `useAddTransaction` (lines 125-217) - Comprehensive with rollback
- `useUpdateTransaction` (lines 265-351) - Balance delta calculation
- `useDeleteTransaction` (lines 399-455) - Proper cleanup
- `useBulkUpdateTransactions` (lines 551-619) - True optimistic with snapshot

---

## 5. Architecture Compliance Summary

### Key Files and Responsibilities

| File | Responsibility |
|------|---------------|
| `domain/entities.ts` | Core transaction data structures (readonly) |
| `domain/types.ts` | DTOs, filters, result types (22 types) |
| `domain/errors.ts` | Typed error classes with guards (8 errors) |
| `domain/constants.ts` | Validation limits (3 constant objects) |
| `repository/transaction-repository.interface.ts` | Data access contract (12 methods) |
| `repository/supabase-transaction-repository.ts` | Remote database operations |
| `repository/local-transaction-repository.ts` | Local-first storage with CTO mandates |
| `repository/hybrid-transaction-repository.ts` | Orchestration layer |
| `services/transaction-service.ts` | Business logic + auth context |
| `services/transaction-routing-service.ts` | Ledger vs Inbox routing with IoC |
| `hooks/use-transactions.ts` | React Query with optimistic updates |
| `hooks/use-transaction-routing.ts` | Routing hook with cache manipulation |
| `hooks/use-bulk-selection.ts` | Bulk selection with filterKey pattern |
| `schemas/transaction.schema.ts` | Zod validation (4 schemas) |
| `stores/transaction-selection-store.ts` | Zustand selection state |

### CTO Mandates Checklist

| Mandate | Implementation | Status |
|---------|---------------|--------|
| `amountCents`: INTEGER CENTS | Math.round() everywhere | ✅ PASS |
| No floating-point comparisons | Verified | ✅ PASS |
| ISO 8601 date strings | entities.ts | ✅ PASS |
| `DataResult<T>` pattern | domain/types | ✅ PASS |
| `instanceof` error handling | errors.ts type guards | ✅ PASS |
| Tombstone soft deletes | activeTombstoneFilter() | ✅ PASS |
| Version-checked RPC | supabase-repo + auto-retry | ✅ PASS |
| IAuthProvider abstraction | transaction-service.ts:17 | ✅ PASS |
| React Compiler compatible | No watch() calls | ✅ PASS |
| Delta Sync support | getChangesSince() | ✅ PASS |
| No N+1 queries | enrichWithJoinedData() batch | ✅ PASS |
| IoC for inbox | IInboxOperations interface | ✅ PASS |

---

## 6. Recommendations

### High Priority

1. **Fix `undefined as any` Type Assertions**
   - **Files**: `local-transaction-repository.ts:686,699,988`, `supabase-transaction-repository.ts:543`
   - **Issue**: Forces undefined to match void return type
   - **Fix**: Restructure return type or use proper type guard

### Medium Priority

2. **Refactor Remaining Cross-Feature Dependencies (21 violations)**
   - Extract account/category types to `@/lib/types/domain`
   - Create IoC interfaces like inbox pattern for reconciliations
   - Move shared hooks to `@/lib/hooks`

3. **Fix useVirtualizer Dependency Warnings**
   - **File**: `components/transaction-list.tsx:152,160,174`
   - **Fix**: Use stable key or useRef pattern

### Low Priority

4. **Consider Explicit staleTime Configuration**
   - **File**: `hooks/use-transactions.ts`
   - Currently using defaults (0ms = immediately stale)
   - Consider 30-60 seconds for financial data

5. **Minor Inline Callback Optimization**
   - **File**: `components/transfer-form.tsx:82-101`
   - Extract inline arrows in SourceCard to useCallback

---

## 7. Appendix

### 7.1 Zod Schemas (`schemas/transaction.schema.ts`)

| Schema | Lines | Purpose | Key Validations |
|--------|-------|---------|-----------------|
| `createTransactionSchema` | 25-68 | Flexible for inbox routing | amount_cents: int, !== 0; account_id: optional |
| `createTransactionLedgerSchema` | 79-89 | Strict for ledger writes | account_id: REQUIRED; Omits currency_original |
| `updateTransactionSchema` | 93-142 | Partial update | version: REQUIRED positive int |
| `quickAddTransactionSchema` | 149-181 | Quick add to inbox | description, amount_cents required |

**Inferred Types:**
```typescript
export type CreateTransactionFormData = z.infer<typeof createTransactionSchema>;
export type CreateTransactionLedgerData = z.infer<typeof createTransactionLedgerSchema>;
export type UpdateTransactionFormData = z.infer<typeof updateTransactionSchema>;
export type QuickAddTransactionFormData = z.infer<typeof quickAddTransactionSchema>;
```

### 7.2 Database Row Validation (`lib/data/db-row-schemas.ts`)

```typescript
export const TransactionRowSchema = z.object({
  amount_original: z.number().int(),  // STRICTLY integer
  amount_home: z.number().int(),      // STRICTLY integer
  // ... other snake_case fields
});
```

### 7.3 Performance Scorecard

| Category | Grade | Notes |
|----------|-------|-------|
| React Compiler Check | A+ | No watch() patterns |
| useEffect Dependencies | B+ | 3 virtualizer warnings |
| useMemo Dependencies | A | All correct |
| useCallback Dependencies | A+ | Complete, minimal, no issues |
| Query Patterns | A | No N+1, proper guards |
| Component Memoization | A+ | Excellent with custom comparators |
| Optimistic Updates | A+ | Comprehensive with rollback |
| Overall | **A-** | Very Good |

---

## Audit History

| Date | Auditor | Key Changes |
|------|---------|-------------|
| 2026-01-28 | Senior Systems Architect | Initial audit - 26 issues |
| 2026-01-30 | Senior Systems Architect | Re-audit: Integer cents FIXED, feature bleed ↓4, 2 type safety issues added, 3 performance warnings added |
