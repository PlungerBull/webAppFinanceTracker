# Composable Manifest: features/transactions

> **Generated**: 2026-02-01
> **Auditor**: Claude (Senior Systems Architect)
> **Scope**: `/features/transactions/` folder
> **Status**: PASS WITH WARNINGS
> **Grade**: B+

---

## Executive Summary

| Metric | Result |
|--------|--------|
| Cross-Feature Violations | 1 (`use-transaction-filters.ts` → groupings) |
| Zero-Any Violations | 1 (justified - Supabase PostgrestFilterBuilder) |
| Spaghetti Violations | 0 (1 borderline case) |
| Ghost Props | 3 (`createdAt`, `updatedAt`, `sourceText`) |
| Schema Drift | None |
| Integer Cents | PASS - All monetary values use `amountCents` |
| DataResult Pattern | PASS - All repositories return `DataResult<T>` |
| Boundary Mapping | PASS - `snake_case` to `camelCase` transforms |

---

## 1. Dependency Map

### 1.1 File Inventory

```
features/transactions/
├── api/
│   └── filters.ts
├── components/
│   ├── account-currency-selector.tsx
│   ├── account-transactions-table.tsx
│   ├── add-transaction-modal.tsx
│   ├── all-transactions-table.tsx
│   ├── bulk-action-bar.tsx
│   ├── ledger-transaction-modal-content.tsx
│   ├── monthly-spending-table.tsx
│   ├── smart-selector.tsx
│   ├── transaction-detail-panel.tsx
│   ├── transaction-filter-bar.tsx
│   ├── transaction-form.tsx
│   ├── transaction-header.tsx
│   ├── transaction-info.tsx
│   ├── transaction-type-tabs.tsx
│   ├── transfer-form.tsx
│   └── transfer-modal-content.tsx
├── contexts/
│   └── transaction-modal-context.tsx
├── domain/
│   ├── constants.ts
│   ├── entities.ts
│   ├── errors.ts
│   ├── index.ts
│   └── types.ts
├── hooks/
│   ├── __tests__/
│   │   └── use-transfer-resolution.test.ts
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
├── repository/
│   ├── hybrid-transaction-repository.ts
│   ├── index.ts
│   ├── local-transaction-repository.ts
│   ├── supabase-transaction-repository.ts
│   ├── supabase-transfer-repository.ts
│   ├── sync-repository.interface.ts
│   ├── transaction-repository.interface.ts
│   └── transfer-repository.interface.ts
├── schemas/
│   └── transaction.schema.ts
└── services/
    ├── __tests__/
    │   └── transaction-routing-service.test.ts
    ├── index.ts
    ├── transaction-routing-service.interface.ts
    ├── transaction-routing-service.ts
    ├── transaction-service.interface.ts
    ├── transaction-service.ts
    ├── transfer-service.interface.ts
    └── transfer-service.ts
```

**Total Files**: 51 (including tests, excluding index.ts barrel exports)

### 1.2 External Package Imports

| Package | Usage |
|---------|-------|
| `react` | Hooks (useState, useMemo, useCallback, useEffect, memo) |
| `react-hook-form` | Form state management |
| `@hookform/resolvers/zod` | Form validation |
| `zod` | Schema validation |
| `@tanstack/react-query` | Data fetching (useQuery, useInfiniteQuery, useMutation) |
| `next/navigation` | Routing (useSearchParams) |
| `lucide-react` | Icons |
| `sonner` | Toast notifications |
| `date-fns` | Date formatting |
| `@supabase/supabase-js` | Supabase client types |

### 1.3 Project Imports - ALLOWED

| Import Source | Files Using | Purpose |
|---------------|-------------|---------|
| `@/lib/constants` | 8 | PAGINATION, QUERY_KEYS, VALIDATION |
| `@/lib/utils` | 12 | cn() utility |
| `@/lib/utils/cents-parser` | 4 | displayAmountToCents, centsToDisplayAmount |
| `@/lib/utils/balance-logic` | 1 | calculateBalanceDeltas, calculateCreateDelta |
| `@/lib/utils/date-validation` | 1 | validateISODate |
| `@/lib/data/data-transformers` | 2 | dbTransactionViewToDomain |
| `@/lib/data/db-row-schemas` | 1 | TransactionsViewRowSchema |
| `@/lib/data/validate` | 1 | validateOrThrow, validateArrayOrThrow |
| `@/lib/data-patterns` | 1 | DataResult, PaginatedResult, SyncResponse |
| `@/lib/auth` | 1 | IAuthProvider interface |
| `@/lib/supabase/client` | 1 | createClient |
| `@/lib/hooks/use-bulk-selection` | 1 | useBulkSelection |
| `@/lib/hooks/use-grouped-accounts` | 3 | useGroupedAccounts |
| `@/lib/hooks/use-reference-data` | 3 | useCategoriesData, useAccountsData |
| `@/lib/hooks/use-user-settings` | 1 | useUserSettings, useUpdateSortPreference |
| `@/lib/hooks/use-is-mobile` | 1 | useIsMobile |
| `@/lib/hooks/use-reconciliations` | 1 | useReconciliations, useReconciliationSummary |
| `@/lib/query/cache-types` | 1 | TransactionInfiniteCache, InfinitePage |
| `@/types/supabase` | 2 | Database types |
| `@/types/domain` | 1 | TransactionSortMode |
| `@/components/ui/*` | 10 | Button, Input, Calendar, Sheet, Select, etc. |
| `@/components/shared/*` | 3 | TransactionList, CategorySelector |
| `@/components/layout/*` | 1 | Sidebar, MobileHeader |
| `@/contexts/sidebar-context` | 1 | SidebarProvider |
| `@/domain/inbox` | 2 | IInboxOperations, InboxItemViewEntity |
| `@/domain/accounts` | 2 | AccountViewEntity (type import) |

### 1.4 Cross-Feature Import Violations

| File | Import | Severity | Status |
|------|--------|----------|--------|
| `use-transaction-filters.ts:19` | `@/features/groupings/hooks/use-groupings` | **HIGH** | VIOLATION |
| `transaction-detail-panel.tsx` | `@/features/accounts/domain` | LOW | Type import only |
| `transaction-detail-panel.tsx` | `@/features/categories/domain` | LOW | Type import only |

**Finding**: One functional violation detected. `use-transaction-filters.ts` imports `useGroupingChildren` hook directly from the groupings feature. This creates tight coupling that could break if the groupings feature changes.

**Recommendation**: Create `@/lib/hooks/use-grouping-children.ts` that wraps the groupings repository, then update transactions to use the shared hook.

---

## 2. Schema Compliance

### 2.1 Zod Schema Definition

**File**: `features/transactions/schemas/transaction.schema.ts`

```typescript
// createTransactionSchema (lines 28-45)
export const createTransactionSchema = z.object({
  description: z.string().nullable().optional(),
  amount_cents: z.number().int('Amount must be integer cents'),
  date: z.string().min(1),
  category_id: z.string().uuid().nullable().optional(),
  account_id: z.string().uuid().nullable().optional(),
  currency_original: z.string().length(3).regex(/^[A-Z]{3}$/),
  exchange_rate: z.number().positive(),
  type: z.enum(['income', 'expense', 'opening_balance']).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

// updateTransactionSchema (lines 100-120)
export const updateTransactionSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  amount_cents: z.number().int('Amount must be integer cents').optional(),
  // ... other fields
});
```

### 2.2 DB Row Schema (Boundary Validation)

**File**: `lib/data/db-row-schemas.ts` (lines 183-212)

```typescript
export const TransactionsViewRowSchema = z.object({
  id: z.string().nullable(),
  user_id: z.string().nullable(),
  account_id: z.string().nullable(),
  account_name: z.string().nullable(),
  account_color: z.string().nullable(),
  category_id: z.string().nullable(),
  category_name: z.string().nullable(),
  category_color: z.string().nullable(),
  category_type: TransactionTypeEnum.nullable(),
  amount_cents: z.number().int().nullable(),
  amount_home_cents: z.number().int().nullable(),
  currency_original: z.string().nullable(),
  exchange_rate: z.number().nullable(),
  date: z.string().nullable(),
  description: z.string().nullable(),
  notes: z.string().nullable(),
  source_text: z.string().nullable(),
  transfer_id: z.string().nullable(),
  inbox_id: z.string().nullable(),
  cleared: z.boolean().nullable(),
  reconciliation_id: z.string().nullable(),
  reconciliation_status: ReconciliationStatusEnum.nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  deleted_at: z.string().nullable(),
  version: z.number().nullable(),
});
```

### 2.3 Supabase Generated Types Comparison

**File**: `types/supabase.ts` (transactions_view)

| Field | Zod Schema | Supabase Types | Domain Entity | Match |
|-------|------------|----------------|---------------|-------|
| `id` | `z.string().nullable()` | `string \| null` | `string` | YES |
| `user_id` | `z.string().nullable()` | `string \| null` | `string` | YES |
| `account_id` | `z.string().nullable()` | `string \| null` | `string` | YES |
| `amount_cents` | `z.number().int().nullable()` | `number \| null` | `number` | YES |
| `amount_home_cents` | `z.number().int().nullable()` | `number \| null` | `number` | YES |
| `currency_original` | `z.string().nullable()` | `string \| null` | `string \| null` | YES |
| `exchange_rate` | `z.number().nullable()` | `number \| null` | `number` | YES |
| `date` | `z.string().nullable()` | `string \| null` | `string` | YES |
| `description` | `z.string().nullable()` | `string \| null` | `string \| null` | YES |
| `notes` | `z.string().nullable()` | `string \| null` | `string \| null` | YES |
| `source_text` | `z.string().nullable()` | `string \| null` | `string \| null` | YES |
| `transfer_id` | `z.string().nullable()` | `string \| null` | `string \| null` | YES |
| `version` | `z.number().nullable()` | `number` | `number` | YES |

### 2.4 Schema Drift Analysis

**Finding**: No schema drift detected. All fields align between Zod validation schemas, Supabase generated types, and domain entities.

---

## 3. Entity Audit (Ghost Prop Audit)

### 3.1 TransactionEntity (Base)

**Source**: `features/transactions/domain/entities.ts` (lines 62-235)

| Property | Type | UI Usage | Business Logic Usage | Status |
|----------|------|----------|---------------------|--------|
| `id` | `string` | All tables (key), detail panel | All CRUD, cache keys | **ACTIVE** |
| `version` | `number` | Passed to mutations | Conflict detection, sync | **ACTIVE** |
| `userId` | `string` | N/A (RLS handles) | Repository auth filter | **ACTIVE** |
| `amountCents` | `number` | All tables (formatted), forms | Balance calculations, mutations | **ACTIVE** |
| `amountHomeCents` | `number` | Reconciliation diff, balance | Currency conversion display | **ACTIVE** |
| `currencyOriginal` | `string \| null` | Transaction detail, tables | Exchange rate logic | **ACTIVE** |
| `exchangeRate` | `number` | Transfer form, detail panel | Cross-currency transfers | **ACTIVE** |
| `accountId` | `string` | Detail panel (selector) | All CRUD, balance deltas | **ACTIVE** |
| `categoryId` | `string \| null` | Detail panel, bulk action bar | Routing decision, mutations | **ACTIVE** |
| `transferId` | `string \| null` | Transfer pair detection | isTransferTransaction() guard | **ACTIVE** |
| `description` | `string \| null` | Tables (display), detail panel | Routing decision, search | **ACTIVE** |
| `notes` | `string \| null` | Detail panel (editable) | Mutations | **ACTIVE** |
| `date` | `string` | Tables, detail panel, filter bar | Sorting, filtering | **ACTIVE** |
| `createdAt` | `string` | **NONE** | Sort stability tie-breaker | **GHOST (Infrastructure)** |
| `updatedAt` | `string` | **NONE** | Optimistic update construction | **GHOST (Infrastructure)** |
| `deletedAt` | `string \| null` | N/A | Tombstone filtering, sync | **ACTIVE (Sync)** |
| `reconciliationId` | `string \| null` | Bulk action bar | Link/unlink reconciliation | **ACTIVE** |
| `cleared` | `boolean` | N/A (internal) | Reconciliation status | **ACTIVE** |
| `sourceText` | `string \| null` | **NONE** | Inbox promotion flow only | **GHOST (Inbox Feature)** |
| `inboxId` | `string \| null` | N/A | Inbox promotion tracking | **ACTIVE (Inbox)** |

### 3.2 TransactionViewEntity (Extended)

**Source**: `features/transactions/domain/entities.ts` (lines 286-331)

| Property | Type | UI Usage | Business Logic Usage | Status |
|----------|------|----------|---------------------|--------|
| (inherits TransactionEntity) | - | - | - | - |
| `accountName` | `string \| null` | Tables, detail panel | Display only | **ACTIVE** |
| `accountColor` | `string \| null` | Transaction row styling | Display only | **ACTIVE** |
| `categoryName` | `string \| null` | Tables, detail panel | Display only | **ACTIVE** |
| `categoryColor` | `string \| null` | Category badge styling | Display only | **ACTIVE** |
| `categoryType` | `'income' \| 'expense' \| 'opening_balance' \| null` | Amount coloring (+/-) | Display logic | **ACTIVE** |
| `reconciliationStatus` | `'draft' \| 'completed' \| null` | N/A | Reconciliation workflow | **ACTIVE** |

### 3.3 Ghost Prop Summary

| Entity | Ghost Props | Justification | Recommendation |
|--------|-------------|---------------|----------------|
| TransactionEntity | `createdAt` | Used as tie-breaker in ORDER BY for sort stability | Mark as `@infrastructure` |
| TransactionEntity | `updatedAt` | Used in optimistic update entity construction | Mark as `@infrastructure` |
| TransactionEntity | `sourceText` | Only used in inbox-to-ledger promotion flow | Mark as `@inboxFeature` |

**CTO Mandate Compliance**: These ghost props serve infrastructure purposes (sorting, sync, inbox promotion) and are not arbitrary. Document as "Infrastructure Use" rather than deprecating.

---

## 4. Local "Spaghetti" Report

### 4.1 Component Analysis Matrix

| Component | File | Lines Before Render | Direct DB | Business Logic | Status |
|-----------|------|---------------------|-----------|----------------|--------|
| AllTransactionsTable | all-transactions-table.tsx | ~90 | None | Sort preference derived state | **CLEAN** |
| BulkActionBar | bulk-action-bar.tsx | ~50 | None | PreviewDiff calculation (useMemo) | **BORDERLINE** |
| TransferForm | transfer-form.tsx | ~20 | None | Delegates to useTransferResolution | **CLEAN** |
| TransactionDetailPanel | transaction-detail-panel.tsx | ~60 | None | EditedFields merge logic | **ACCEPTABLE** |
| LedgerTransactionModalContent | ledger-transaction-modal-content.tsx | ~30 | None | DTO conversion via formDataToDTO() | **CLEAN** |
| TransferModalContent | transfer-modal-content.tsx | ~25 | None | Delegates to useCreateTransfer | **CLEAN** |
| TransactionFilterBar | transaction-filter-bar.tsx | ~15 | None | Pure props, no hooks | **CLEAN** |
| SmartSelector | smart-selector.tsx | ~10 | None | Pure presentational | **CLEAN** |
| TransactionTypeTabs | transaction-type-tabs.tsx | ~5 | None | Pure presentational | **CLEAN** |
| TransactionHeader | transaction-header.tsx | ~20 | None | Pure presentational | **CLEAN** |
| TransactionInfo | transaction-info.tsx | ~10 | None | Pure presentational | **CLEAN** |
| TransactionForm | transaction-form.tsx | ~15 | None | Form state only | **CLEAN** |
| AccountCurrencySelector | account-currency-selector.tsx | ~10 | None | Pure presentational | **CLEAN** |
| AccountTransactionsTable | account-transactions-table.tsx | ~5 | None | Wrapper component | **CLEAN** |
| AddTransactionModal | add-transaction-modal.tsx | ~20 | None | Dialog orchestration | **CLEAN** |
| MonthlySpendingTable | monthly-spending-table.tsx | ~15 | None | Delegates to useMonthlySpending | **CLEAN** |

### 4.2 Detailed Analysis

#### all-transactions-table.tsx
- **Sort Preference Logic** (lines 51-69): Derives `sortBy` from server state + local override. This is UI-specific state management, not business logic.
- **Data Composition**: Uses 8 hooks for data fetching and state management. All business logic properly delegated.
- **Bulk Selection**: Delegates to `useBulkSelection` domain hook.

#### bulk-action-bar.tsx (BORDERLINE)
- **PreviewDiff Calculation** (lines 94-123): ~30 lines of reconciliation math in useMemo:
  ```typescript
  const previewLinkedSum = currentLinkedSum + selectedSum;
  const previewDifference = endingBalance - (beginningBalance + previewLinkedSum);
  const isBalanced = Math.abs(previewDifference) < 0.005;
  ```
- **Recommendation**: Extract `calculatePreviewDiff()` to `@/lib/utils/reconciliation-math.ts` for reuse and testing.

#### transaction-detail-panel.tsx
- **EditedFields Merge Logic** (lines 126-176): ~50 lines merging edited fields with current state.
- **Acceptable** because it's UI-specific (handling undefined vs null vs value semantics).
- The actual update logic is delegated to `useTransactionUpdate` hook.

#### ledger-transaction-modal-content.tsx
- **DTO Conversion** (lines 76-92): Pure function `formDataToDTO()` converts form state to service contract.
- **Correct placement** - component boundary conversion per CTO mandate.

### 4.3 Violations Summary

| Violation Type | Count | Details |
|----------------|-------|---------|
| Direct Supabase calls in components | 0 | All through hooks |
| Business logic in components | 0 | Only UI-specific derivations |
| Data transformation in components | 1 | formDataToDTO() - ACCEPTABLE per CTO mandate |

**Finding**: Zero spaghetti violations. All business logic properly encapsulated:
- **Service Layer**: Routing decisions, validation, sanitization
- **Repository Layer**: Data access, error mapping, boundary transformation
- **Hooks Layer**: React Query integration, optimistic updates
- **Components**: Composition and event handling

---

## 5. Type Safety Audit

### 5.1 Zero-Any Scan

| File | Line | Pattern | Justification |
|------|------|---------|---------------|
| `supabase-transaction-repository.ts` | 93-97 | `any` (2x) | Supabase PostgrestFilterBuilder generic complexity |

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
private applyFilters(query: any, filters?: TransactionFilters): any {
  // Type safety maintained through consistent filter field names
```

**Finding**: Single justified exception. The Supabase `PostgrestFilterBuilder` generic types vary by table/view and are complex. The ESLint disable comment documents the reason.

### 5.2 Integer Cents Compliance

All monetary operations verified:

| Location | Pattern | Status |
|----------|---------|--------|
| `entities.ts` | `amountCents: number`, `amountHomeCents: number` | PASS |
| `types.ts` | `CreateTransactionDTO.amountCents`, `UpdateTransactionDTO.amountCents` | PASS |
| `transaction.schema.ts` | `z.number().int()` with validation | PASS |
| `supabase-transaction-repository.ts` | Direct BIGINT insert/read | PASS |
| `use-transactions.ts` | Integer cents in optimistic updates | PASS |
| `bulk-action-bar.tsx` | `centsToDisplayAmount()` for display | PASS |

---

## 6. Architectural Patterns Detected

### 6.1 Transaction Routing Service (Smart Routing)
- **Pure determineRoute()**: No side effects, deterministic, testable
- **Automatic Promotion/Demotion**: Inbox <-> Ledger based on field completeness
- **Sacred Ledger Rule**: `amountCents: 0` treated as MISSING

### 6.2 Optimistic Concurrency Control
- Every write includes `version` field
- Service auto-retries on conflict (max 2 attempts)
- Repository checks via RPC (`update_transaction_with_version`)

### 6.3 Tombstone Pattern
- Soft delete via `deleted_at` timestamp
- All queries filter `is('deleted_at', null)`
- `getDeleted()` method for sync delta

### 6.4 Write-then-Read Pattern
- CREATE inserts to `transactions` table
- Immediately SELECTs from `transactions_view` for complete data
- Ensures joined fields (accountName, categoryColor) are populated

### 6.5 Orchestrator Rule
- `useTransactionService()` returns null until initialized
- Queries use `enabled: !!service`
- Prevents race conditions during service initialization

### 6.6 Hybrid Repository (Local-First)
- **Local-First Reads**: All queries → LocalTransactionRepository (WatermelonDB)
- **Local-First Writes**: All writes → LocalTransactionRepository (marked 'pending')
- **Remote Access**: Only exposed for sync engine
- Graceful degradation if local unavailable

---

## 7. Recommendations

### 7.1 Immediate Actions (P1)

| Action | File | Effort |
|--------|------|--------|
| Fix cross-feature import | `use-transaction-filters.ts` → create `@/lib/hooks/use-grouping-children.ts` | Medium |

### 7.2 Short-Term Actions (P2)

| Action | File | Effort |
|--------|------|--------|
| Extract reconciliation math | `bulk-action-bar.tsx` → `@/lib/utils/reconciliation-math.ts` | Low |
| Add JSDoc `@infrastructure` to `createdAt`, `updatedAt` | `entities.ts` | Low |
| Add JSDoc `@inboxFeature` to `sourceText` | `entities.ts` | Low |

### 7.3 Future Considerations (P3)

| Item | Rationale |
|------|-----------|
| Add "Created" timestamp to transaction detail | Audit trail visibility |
| Display `updatedAt` as "Last modified" indicator | User awareness |

---

## 8. Compliance Checklist

| Rule | Status | Evidence |
|------|--------|----------|
| Integer Cents Only | **PASS** | All `amountCents`, `amountHomeCents` are `number.int()` |
| Result Pattern (DataResult<T>) | **PASS** | All repository methods return DataResult |
| Zero-Any Policy | **PASS** (1 justified) | Single exception with ESLint disable + comment |
| Boundary Mapping | **PASS** | `dbTransactionViewToDomain` in data-transformers.ts |
| No Cross-Feature Imports | **FAIL** (1) | `use-transaction-filters.ts` imports groupings hook |
| Business Logic Placement | **PASS** | All in service/repository layers |

---

## Appendix: Files Analyzed

```
features/transactions/api/filters.ts
features/transactions/components/account-currency-selector.tsx
features/transactions/components/account-transactions-table.tsx
features/transactions/components/add-transaction-modal.tsx
features/transactions/components/all-transactions-table.tsx
features/transactions/components/bulk-action-bar.tsx
features/transactions/components/ledger-transaction-modal-content.tsx
features/transactions/components/monthly-spending-table.tsx
features/transactions/components/smart-selector.tsx
features/transactions/components/transaction-detail-panel.tsx
features/transactions/components/transaction-filter-bar.tsx
features/transactions/components/transaction-form.tsx
features/transactions/components/transaction-header.tsx
features/transactions/components/transaction-info.tsx
features/transactions/components/transaction-type-tabs.tsx
features/transactions/components/transfer-form.tsx
features/transactions/components/transfer-modal-content.tsx
features/transactions/contexts/transaction-modal-context.tsx
features/transactions/domain/constants.ts
features/transactions/domain/entities.ts
features/transactions/domain/errors.ts
features/transactions/domain/index.ts
features/transactions/domain/types.ts
features/transactions/hooks/__tests__/use-transfer-resolution.test.ts
features/transactions/hooks/use-direction-toggle.ts
features/transactions/hooks/use-monthly-spending.ts
features/transactions/hooks/use-transaction-filters.ts
features/transactions/hooks/use-transaction-routing.ts
features/transactions/hooks/use-transaction-service.ts
features/transactions/hooks/use-transaction-update.ts
features/transactions/hooks/use-transactions.ts
features/transactions/hooks/use-transfer-calculation.ts
features/transactions/hooks/use-transfer-resolution.ts
features/transactions/hooks/use-transfer-service.ts
features/transactions/hooks/use-transfers.ts
features/transactions/repository/hybrid-transaction-repository.ts
features/transactions/repository/index.ts
features/transactions/repository/local-transaction-repository.ts
features/transactions/repository/supabase-transaction-repository.ts
features/transactions/repository/supabase-transfer-repository.ts
features/transactions/repository/sync-repository.interface.ts
features/transactions/repository/transaction-repository.interface.ts
features/transactions/repository/transfer-repository.interface.ts
features/transactions/schemas/transaction.schema.ts
features/transactions/services/__tests__/transaction-routing-service.test.ts
features/transactions/services/index.ts
features/transactions/services/transaction-routing-service.interface.ts
features/transactions/services/transaction-routing-service.ts
features/transactions/services/transaction-service.interface.ts
features/transactions/services/transaction-service.ts
features/transactions/services/transfer-service.interface.ts
features/transactions/services/transfer-service.ts
lib/data/db-row-schemas.ts (TransactionsViewRowSchema)
lib/data/data-transformers.ts (dbTransactionViewToDomain)
types/supabase.ts (transactions, transactions_view)
```
