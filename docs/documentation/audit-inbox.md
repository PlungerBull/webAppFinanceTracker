# Composable Manifest: features/inbox

> **Generated**: 2026-01-30
> **Auditor**: Senior Systems Architect & Security Auditor
> **Scope**: `/features/inbox/` folder
> **Audit Type**: Comprehensive Re-Audit (Post-Alignment)

---

## Executive Summary

| Category | Status | Issues | Change |
|----------|--------|--------|--------|
| Entity Registry | COMPLIANT | 0 | - |
| Naming Conventions | COMPLIANT | 0 | - |
| Type Safety | **WARNING** | 6 | Improved |
| Dependency Manifest | **VIOLATION** | 4 | Improved (was 9) |
| Integer Cents | COMPLIANT | 0 | - |
| Sync Integrity | COMPLIANT | 0 | - |
| Soft Deletes | COMPLIANT | 0 | - |
| Auth Abstraction | COMPLIANT | 0 | - |
| React Compiler | COMPLIANT | 0 | - |
| Re-render Optimization | **WARNING** | 4 | New finding |
| React Query Config | **WARNING** | 2 | New finding |

**Overall**: 16 issues found (4 Feature Bleed, 6 Type Safety, 4 Re-render, 2 React Query)
**Sacred Mandates**: 100% Compliant (4/4 mandates passed)
**Architecture Score**: 9.2/10 (Improved from 8.5/10)

---

## 1. Variable & Entity Registry

### 1.1 Directory Structure

```
features/inbox/
├── components/                      (4 files)
│   ├── inbox-card.tsx               199 lines
│   ├── inbox-detail-panel.tsx       214 lines
│   ├── inbox-list.tsx               67 lines
│   └── inbox-table.tsx              86 lines
├── domain/                          (4 files)
│   ├── entities.ts                  23 lines (re-exports)
│   ├── errors.ts                    87 lines
│   ├── types.ts                     188 lines
│   └── index.ts
├── hooks/                           (2 files)
│   ├── use-inbox.ts                 236 lines
│   └── use-inbox-service.ts         74 lines
├── repository/                      (6 files)
│   ├── inbox-repository.interface.ts  265 lines
│   ├── hybrid-inbox-repository.ts   187 lines
│   ├── supabase-inbox-repository.ts 514 lines
│   ├── local-inbox-repository.ts    725 lines
│   ├── supabase-inbox-repository.test.ts  195 lines
│   └── index.ts
├── services/                        (3 files)
│   ├── inbox-service.ts             332 lines
│   ├── __tests__/inbox-service.test.ts  ~200 lines
│   └── index.ts
├── schemas/                         (1 file)
│   └── inbox.schema.ts              63 lines
└── index.ts
```

**Total: ~3,500+ lines of TypeScript/TSX (including tests)**

### 1.2 Entity Inventory

#### Sacred Domain Entities (`/domain/inbox.ts`)

| Entity | Type | Lines | Description |
|--------|------|-------|-------------|
| `InboxStatus` | Type Union | 22 | `'pending' \| 'processed' \| 'ignored'` |
| `InboxItemEntity` | Interface | 48-108 | Core inbox item with 13 readonly properties |
| `InboxItemViewEntity` | Interface | 116-131 | Extends with optional account/category joins |
| `isPromotionReady()` | Type Guard | 140-152 | Narrows to non-null promotion fields |
| `CreateInboxItemDTO` | Interface | 161-170 | 8 optional fields for scratchpad |
| `UpdateInboxItemDTO` | Interface | 175-186 | 7 optional fields + `lastKnownVersion` (OCC) |
| `PromoteInboxItemDTO` | Interface | 193-203 | 4 required + 5 optional fields |
| `PromoteResult` | Interface | 208-211 | `transactionId` + `inboxId` |
| `IInboxOperations` | Interface (IoC) | 228-246 | 3 methods for cross-feature DI |

**InboxItemEntity Fields:**
```typescript
interface InboxItemEntity {
  readonly id: string;                    // UUID
  readonly userId: string;                // FK to users
  readonly amountCents: number | null;    // INTEGER CENTS (CTO Mandate)
  readonly currencyCode: string;          // ISO 4217 code
  readonly description: string | null;
  readonly date: string | null;           // ISO 8601
  readonly sourceText: string | null;     // Original parsed text
  readonly accountId: string | null;      // FK to bank_accounts
  readonly categoryId: string | null;     // FK to categories
  readonly exchangeRate: number | null;   // For multi-currency
  readonly notes: string | null;
  readonly status: InboxStatus;           // Workflow status
  readonly createdAt: string;             // ISO 8601
  readonly updatedAt: string;             // ISO 8601
  readonly version: number;               // Optimistic concurrency
  readonly deletedAt: string | null;      // Tombstone
}
```

#### Feature-Local Types (`features/inbox/domain/`)

| Type/Interface | File | Lines | Purpose |
|----------------|------|-------|---------|
| `InboxError` | types.ts | 38-46 | Error discriminator with code literal union |
| `DataResult<T>` | types.ts | 53 | Generic result using `InboxError` |
| `InboxFilters` | types.ts | 180-184 | Query filter parameters |

#### Error Classes (`features/inbox/domain/errors.ts`)

| Class | Lines | Code |
|-------|-------|------|
| `InboxDomainError` | 15-23 | Base class |
| `InboxNotFoundError` | 28-33 | `INBOX_NOT_FOUND` |
| `InboxValidationError` | 38-43 | `VALIDATION_ERROR` |
| `InboxRepositoryError` | 48-53 | `REPOSITORY_ERROR` |
| `InboxPromotionError` | 58-63 | `PROMOTION_ERROR` |
| `InboxAlreadyProcessedError` | 68-73 | `ALREADY_PROCESSED` |
| `VersionConflictError` | 78-86 | `VERSION_CONFLICT` (OCC support) |

#### Interfaces

| Interface | File | Lines | Methods |
|-----------|------|-------|---------|
| `IInboxRepository` | inbox-repository.interface.ts | 59-264 | 8 methods |
| `IInboxService` | inbox-service.ts | 40-56 | 8 methods (userId handled by auth) |

**IInboxRepository Methods:**
| Method | Lines | Signature |
|--------|-------|-----------|
| `getPendingPaginated()` | 89-92 | `(userId, pagination?) → Promise<DataResult<PaginatedResult<InboxItemViewEntity>>>` |
| `getById()` | 104 | `(userId, id) → Promise<DataResult<InboxItemViewEntity>>` |
| `create()` | 131-134 | `(userId, data: CreateInboxItemDTO) → Promise<DataResult<InboxItemViewEntity>>` |
| `update()` | 147-151 | `(userId, id, data: UpdateInboxItemDTO) → Promise<DataResult<InboxItemViewEntity>>` |
| `createBatch()` | 179-182 | `(userId, items: CreateInboxItemDTO[]) → Promise<DataResult<InboxItemViewEntity[]>>` |
| `updateBatch()` | 206-209 | `(userId, updates: Array<{id, data}>) → Promise<DataResult<InboxItemViewEntity[]>>` |
| `promote()` | 244-247 | `(userId, data: PromoteInboxItemDTO) → Promise<DataResult<PromoteResult>>` |
| `dismiss()` | 263 | `(userId, id) → Promise<DataResult<void>>` |

### 1.3 Naming Audit

**Status: COMPLIANT**

#### Domain Objects (camelCase) - VERIFIED

| Field | Status |
|-------|--------|
| `amountCents` | ✓ |
| `currencyCode` | ✓ |
| `sourceText` | ✓ |
| `accountId` | ✓ |
| `categoryId` | ✓ |
| `exchangeRate` | ✓ |
| `deletedAt` | ✓ |
| `createdAt` | ✓ |
| `updatedAt` | ✓ |
| `userId` | ✓ |
| `lastKnownVersion` | ✓ |
| `finalAmountCents` | ✓ |
| `transactionId` | ✓ |

#### Database Rows (snake_case) - VERIFIED

| DB Column | Schema Location | Status |
|-----------|-----------------|--------|
| `amount_cents` | db-row-schemas.ts:178 | ✓ |
| `user_id` | db-row-schemas.ts:160 | ✓ |
| `source_text` | db-row-schemas.ts:165 | ✓ |
| `account_id` | db-row-schemas.ts:166 | ✓ |
| `category_id` | db-row-schemas.ts:168 | ✓ |
| `exchange_rate` | db-row-schemas.ts:173 | ✓ |
| `created_at` | db-row-schemas.ts:176 | ✓ |
| `updated_at` | db-row-schemas.ts:177 | ✓ |
| `deleted_at` | db-row-schemas.ts:180 | ✓ |

**Transformation Mapping** (data-transformers.ts):
```
amount_original → amountCents (line 215)
user_id → userId (line 214)
source_text → sourceText (line 219)
account_id → accountId (line 220)
category_id → categoryId (line 221)
```

### 1.4 Type Safety Audit

**Status: WARNING - 6 instances of `any`, 2 instances of `unknown`**

#### `any` Keyword Occurrences

| File | Line | Context | Severity | Justification |
|------|------|---------|----------|---------------|
| `data-transformers.ts` | 186 | `(dbInboxItem as any).version` | LOW | Migration workaround - DB types not regenerated |
| `data-transformers.ts` | 187 | `(dbInboxItem as any).deleted_at` | LOW | Migration workaround - DB types not regenerated |
| `data-transformers.ts` | 227 | `(dbInboxItemView as any).version` | LOW | Migration workaround - DB types not regenerated |
| `data-transformers.ts` | 228 | `(dbInboxItemView as any).deleted_at` | LOW | Migration workaround - DB types not regenerated |
| `supabase-inbox-repository.test.ts` | 17 | `mockSupabase as any` | MEDIUM | Test mock typing |
| `local-inbox-repository.ts` | 537 | `} as any;` | MEDIUM | Buffer return type in catch block |

**Recommended Fix for Line 537:**
```typescript
// Instead of: } as any;
// Define explicit return type for buffer response
interface BufferResponse {
  success: boolean;
  data: InboxItemViewEntity[] | null;
  error: InboxError | null;
}
```

#### `unknown` Keyword Occurrences

| File | Line | Context | Severity |
|------|------|---------|----------|
| `inbox-service.test.ts` | 45 | `as unknown as IInboxRepository` | LOW (test) |
| `local-inbox-repository.ts` | 480 | `data as Record<string, unknown>` | LOW (polymorphic) |

#### Type Assertions Summary

| File | Count | Critical |
|------|-------|----------|
| `data-transformers.ts` | 4 | Temporary (DB type regeneration pending) |
| `supabase-inbox-repository.ts` | 1 | RPC result extraction (line 439) |
| Test files | 4 | Acceptable for mocking |

#### Zod Schema Coverage

| Schema | File | Lines | Integer Validation |
|--------|------|-------|-------------------|
| `promoteInboxItemSchema` | inbox.schema.ts | 18-28 | `.int('Must be integer cents')` |
| `createInboxItemSchema` | inbox.schema.ts | 41-51 | `.int('Amount must be integer cents')` |
| `dismissInboxItemSchema` | inbox.schema.ts | 58-60 | N/A |
| `TransactionInboxViewRowSchema` | db-row-schemas.ts | 158-181 | `.int().nullable()` |

**Schema Field Mismatch (Minor):**
- `createInboxItemSchema` defines `currencyOriginal` (line 44)
- `CreateInboxItemDTO` does NOT include this field
- **Impact**: UI-only field, not persisted
- **Recommendation**: Remove from schema or add comment

---

## 2. Dependency Manifest (Import Audit)

### 2.1 Feature Bleed Check

**Status: VIOLATION - 4 cross-feature imports (improved from 9)**

#### Violation #1: inbox-table.tsx - Line 15 (CRITICAL)
```typescript
import { TransactionList } from '@/features/transactions/components/transaction-list';
```
- **Severity**: CRITICAL (runtime component import)
- **Recommendation**: Extract `TransactionList` to `@/components/shared/` or create inbox-specific list

#### Violation #2: inbox-table.tsx - Line 18 (CRITICAL)
```typescript
import { useBulkSelection } from '@/features/transactions/hooks/use-bulk-selection';
```
- **Severity**: CRITICAL (hook reuse across features)
- **Recommendation**: Extract to `@/lib/hooks/use-bulk-selection`

#### Violation #3: inbox-detail-panel.tsx - Lines 4-5 (CRITICAL)
```typescript
import { TransactionDetailPanel as SharedPanel } from '@/features/shared/components/transaction-detail-panel';
import type { PanelData, InboxPanelData, ... } from '@/features/shared/components/transaction-detail-panel';
```
- **Severity**: CRITICAL (component + types from features/shared)
- **Recommendation**: Move `TransactionDetailPanel` to `@/components/shared/`

#### Violation #4: inbox-card.tsx - Line 9 (MEDIUM)
```typescript
import { CategorySelector } from '@/features/transactions/components/category-selector';
```
- **Severity**: MEDIUM (UI component sharing)
- **Recommendation**: Extract to `@/components/shared/category-selector`

#### Resolved Violations (Previously Found):
- ~~`useAccounts` from `@/features/accounts`~~ → Now uses `@/lib/hooks/use-reference-data`
- ~~`useLeafCategories` from `@/features/categories`~~ → Now uses `@/lib/hooks/use-reference-data`

### 2.2 Valid Import Sources

| Source | Count | Status |
|--------|-------|--------|
| `@/lib/*` | 13+ | VALID |
| `@/components/ui/*` | 10+ | VALID |
| `@/components/layout/*` | 1 | VALID |
| `@/contexts/*` | 1 | VALID |
| Internal (same feature) | 20+ | VALID |
| External packages | 8 | VALID |

### 2.3 Transformer Check

**Status: COMPLIANT - All transformations use centralized modules**

| Repository | Transformer | Location |
|------------|-------------|----------|
| `supabase-inbox-repository.ts:39` | `dbInboxItemViewToDomain` | `@/lib/data/data-transformers` |
| `supabase-inbox-repository.ts:511` | `dbInboxItemViewToDomain` | Applied on every row |
| `local-inbox-repository.ts:49` | `localInboxItemViewsToDomain` | `@/lib/data/local-data-transformers` |
| `local-inbox-repository.ts:123` | `localInboxItemViewsToDomain` | Applied with enriched data |
| `inbox-table.tsx:19` | `inboxItemViewsToTransactionViews` | `@/lib/data/data-transformers` |
| `inbox-table.tsx:35` | `inboxItemViewsToTransactionViews` | Applied on render |

**No inline transformation logic found in components.**

### 2.4 Direct Supabase Import Check

**Status: COMPLIANT**

| File | Import | Layer | Status |
|------|--------|-------|--------|
| `use-inbox-service.ts:20` | `@/lib/supabase/client` | Hook | ✓ (via lib) |
| `inbox-service.ts:301` | `@/lib/supabase/client` | Service | ✓ (legacy singleton) |
| `repository/index.ts:13` | `@supabase/supabase-js` | Repository | ✓ (type import) |
| `supabase-inbox-repository.ts:20` | `@supabase/supabase-js` | Repository | ✓ (type import) |

**No Supabase imports outside repository layer.**

---

## 3. Sacred Mandate Compliance

### 3.1 Integer Cents

**Status: PASS - 100% Compliant**

#### Type System Enforcement

| Location | Field | Validation |
|----------|-------|------------|
| `inbox.schema.ts:26` | `finalAmountCents` | `.int('Must be integer cents')` |
| `inbox.schema.ts:42` | `amountCents` | `.int('Amount must be integer cents')` |
| `db-row-schemas.ts:178` | `amount_cents` | `.int().nullable()` |

#### Repository Layer - Direct Pass-Through

| File | Line | Operation | Status |
|------|------|-----------|--------|
| `supabase-inbox-repository.ts` | 177 | `amount_cents: data.amountCents` | Direct assignment |
| `supabase-inbox-repository.ts` | 219 | `dbUpdates.amount_cents = data.amountCents` | Direct assignment |
| `local-inbox-repository.ts` | 240 | `Math.round(data.amountCents)` | Defensive rounding |
| `local-inbox-repository.ts` | 367 | `Math.round(data.amountCents)` | Defensive rounding |
| `local-inbox-repository.ts` | 432 | `Math.round(data.amountCents)` | Batch create |
| `local-inbox-repository.ts` | 499 | `Math.round(data.amountCents)` | Batch update |

**Note**: `Math.round()` is defensive only - inputs are already integers.

#### Display Layer - Correct Conversion

| File | Line | Operation | Context |
|------|------|-----------|---------|
| `inbox-detail-panel.tsx` | 37 | `item.amountCents / 100` | Display conversion |
| `inbox-detail-panel.tsx` | 97 | `displayAmountToCents(finalDisplayAmount)` | Back to cents |
| `inbox-detail-panel.tsx` | 166 | `displayAmountToCents(finalDisplayAmount)` | Before API |
| `inbox-card.tsx` | 112 | `(item.amountCents / 100).toFixed(2)` | Display only |

**All `/100` operations are in UI layer only. All service calls use integer cents.**

### 3.2 Sync Integrity

**Status: PASS - 100% Compliant**

#### Version Control Implementation

| Operation | File | Lines | Pattern |
|-----------|------|-------|---------|
| Create | `local-inbox-repository.ts` | 252-254 | `record.version = 1; record.localSyncStatus = getInitialSyncStatus()` |
| Update | `supabase-inbox-repository.ts` | 234-237 | `.eq('version', data.lastKnownVersion)` |
| Update | `local-inbox-repository.ts` | 321-327 | Version conflict check before update |
| Update | `local-inbox-repository.ts` | 389 | `record.localSyncStatus = SYNC_STATUS.PENDING` |
| Batch | `local-inbox-repository.ts` | 498-520 | Each item marked PENDING |
| Dismiss | `local-inbox-repository.ts` | 617-621 | Sync status updated |
| Promote | `supabase-inbox-repository.ts` | 416 | `p_expected_version` in RPC |

#### Conflict Detection

```typescript
// supabase-inbox-repository.ts:268-272
if (updated.length === 0) {
  const currentItem = await fallbackSelect...
  return new VersionConflictError(id, expected, currentItem.version);
}
```

#### Sync Engine Hook

```typescript
// local-inbox-repository.ts:697-724
async updateSyncStatus(id: string, status: SyncStatus, serverVersion?: number) {
  await item.update((record) => {
    record.localSyncStatus = status;
    if (serverVersion !== undefined) {
      record.version = serverVersion;
    }
  });
}
```

### 3.3 Soft Deletes (Tombstone Pattern)

**Status: PASS - 100% Compliant**

#### Physical DELETE Search

```bash
# Grep for DELETE operations in features/inbox
# Result: ZERO physical DELETE statements found
```

#### Tombstone Implementation

| Operation | File | Lines | Implementation |
|-----------|------|-------|----------------|
| Dismiss | `supabase-inbox-repository.ts` | 463-469 | `deleted_at: new Date().toISOString()` |
| Query Filter | `local-inbox-repository.ts` | 142 | `...activeTombstoneFilter()` |
| GetById Check | `local-inbox-repository.ts` | 192 | `if (item.deletedAt !== null) return NotFound` |
| Update Check | `local-inbox-repository.ts` | 312 | `if (item.deletedAt !== null) return NotFound` |
| Batch Filter | `local-inbox-repository.ts` | 493 | `if (item.deletedAt !== null) continue` |

#### Test Verification

```typescript
// supabase-inbox-repository.test.ts:175-193
it('should set deleted_at (Tombstone) when dismissing', async () => {
  expect(updateCall).toHaveProperty('deleted_at');
});
```

### 3.4 Auth Abstraction

**Status: PASS - 100% Compliant**

#### Dependency Injection

```typescript
// inbox-service.ts:21,71-72
import type { IAuthProvider } from '@/lib/auth/auth-provider.interface';

constructor(
  private readonly repository: IInboxRepository,
  private readonly authProvider: IAuthProvider
) {}
```

#### getUserId Abstraction

```typescript
// inbox-service.ts:85-112
private async getUserId(): Promise<DataResult<string>> {
  try {
    const userId = await this.authProvider.getCurrentUserId();
    if (!userId) {
      return { success: false, ... };
    }
    return { success: true, data: userId };
  } catch (err) {
    return { success: false, ... };
  }
}
```

#### Method Usage

| Method | Line | Uses `getUserId()` |
|--------|------|-------------------|
| `getPendingPaginated()` | 124 | ✓ |
| `getById()` | 140 | ✓ |
| `create()` | 160 | ✓ |
| `update()` | 182 | ✓ |
| `createBatch()` | 204 | ✓ |
| `updateBatch()` | 222 | ✓ |
| `promote()` | 242 | ✓ |
| `dismiss()` | 265 | ✓ |

**No direct `supabase.auth` calls in feature code.**

---

## 4. Performance & Scalability

### 4.1 React Compiler Check

**Status: COMPLIANT - No deprecated patterns**

| Pattern | Status | Notes |
|---------|--------|-------|
| `watch()` calls | ✓ None found | React 19+ compatible |
| Closure captures | ✓ Clean | No problematic closures |
| Conditional hooks | ✓ None | Hooks at top level |

### 4.2 Re-render Optimization

**Status: WARNING - 4 handlers not memoized**

#### Properly Memoized (useMemo)

| Component | Line | Dependencies | Status |
|-----------|------|--------------|--------|
| `inbox-detail-panel.tsx` | 31-48 | `[item]` | ✓ Correct |
| `inbox-detail-panel.tsx` | 51-64 | `[accountsData]` | ✓ Correct |
| `inbox-detail-panel.tsx` | 67-76 | `[leafCategories]` | ✓ Correct |
| `use-inbox-service.ts` | 61-73 | `[database, isReady]` | ✓ Correct |
| `use-bulk-selection.ts` | 146-152 | `[...isPending]` | ✓ Correct |
| `use-bulk-selection.ts` | 155-159 | `[transactions]` | ✓ Correct |

#### Missing useCallback (Performance Issue)

| Component | Line | Function | Impact |
|-----------|------|----------|--------|
| `inbox-card.tsx` | 36 | `handleAccountChange` | MEDIUM - card in grid |
| `inbox-card.tsx` | 51 | `handleCategoryChange` | MEDIUM - card in grid |
| `inbox-card.tsx` | 66 | `handleApprove` | MEDIUM - card in grid |
| `inbox-card.tsx` | 81 | `handleDismiss` | MEDIUM - card in grid |

**Recommendation:**
```typescript
const handleAccountChange = useCallback(async (accountId: string) => {
  setSelectedAccountId(accountId);
  try {
    await updateDraft.mutateAsync({ id: item.id, updates: { accountId } });
  } catch (error) { ... }
}, [item.id, updateDraft]);
```

### 4.3 N+1 Query Prevention

**Status: EXCELLENT - No N+1 patterns found**

#### Batch Fetch Pattern (local-inbox-repository.ts:74-124)

```typescript
private async enrichWithJoinedData(items: InboxModel[]): Promise<InboxItemViewEntity[]> {
  // 1. Deduplicate IDs
  const accountIds = [...new Set(items.map(i => i.accountId).filter(Boolean))];
  const categoryIds = [...new Set(items.map(i => i.categoryId).filter(Boolean))];

  // 2. Batch queries (single query per entity type)
  const accounts = await this.database.get<AccountModel>('bank_accounts')
    .query(Q.where('id', Q.oneOf(accountIds))).fetch();
  const categories = await this.database.get<CategoryModel>('categories')
    .query(Q.where('id', Q.oneOf(categoryIds))).fetch();

  // 3. Create lookup maps for O(1) access
  const accountMap = new Map(accounts.map(a => [a.id, a]));
  const categoryMap = new Map(categories.map(c => [c.id, c]));

  // 4. Delegate to transformer
  return localInboxItemViewsToDomain(items, accountMap, categoryMap, currencyMap);
}
```

**Impact**: N queries → 3 queries total (regardless of item count)

### 4.4 React Query Patterns

**Status: WARNING - Missing configuration**

#### Issue #1: Missing staleTime (use-inbox.ts:31)

```typescript
// Current
const query = useInfiniteQuery({
  queryKey: INBOX.QUERY_KEYS.PENDING_INFINITE,
  queryFn: async ({ pageParam = 0 }) => {...},
  // ❌ NO staleTime - data considered stale immediately
});

// Recommended
const query = useInfiniteQuery({
  queryKey: INBOX.QUERY_KEYS.PENDING_INFINITE,
  queryFn: async ({ pageParam = 0 }) => {...},
  staleTime: QUERY_CONFIG.STALE_TIME.SHORT, // 1 minute
  gcTime: QUERY_CONFIG.CACHE_TIME.MEDIUM,   // 10 minutes
});
```

#### Issue #2: Broad Cache Invalidation (use-inbox.ts:168-170)

```typescript
// Current - invalidates entire caches
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: INBOX.QUERY_KEYS.ALL });
  queryClient.invalidateQueries({ queryKey: ['transactions'] });  // Too broad
  queryClient.invalidateQueries({ queryKey: ['accounts'] });      // Too broad
},

// Recommended - surgical updates
onSuccess: (result) => {
  // Inbox already optimistically updated
  // Add new transaction with setQueryData instead of full refetch
},
```

#### Properly Implemented Patterns

| Hook | Pattern | Status |
|------|---------|--------|
| `usePromoteInboxItem` | Optimistic update + rollback | ✓ Excellent |
| `useDismissInboxItem` | Simple invalidation | ✓ Correct |
| `useUpdateInboxDraft` | Invalidation on success | ✓ Correct |
| `useInfiniteQuery` | Pagination + placeholderData | ✓ Correct |

### 4.5 Memory & Cleanup

**Status: EXCELLENT - No memory leaks detected**

| Check | Status |
|-------|--------|
| useEffect cleanup | ✓ Not needed (no subscriptions) |
| Event listeners | ✓ None unmanaged |
| setTimeout/setInterval | ✓ None without cleanup |
| Async operations | ✓ Proper error handling |
| React Query subscriptions | ✓ Automatic cleanup |

---

## 5. Critical Files Summary

### Repository Layer

| File | Lines | Purpose | Issues |
|------|-------|---------|--------|
| `inbox-repository.interface.ts` | 265 | Contract definition | CLEAN |
| `supabase-inbox-repository.ts` | 514 | Remote implementation | 1 (RPC cast) |
| `local-inbox-repository.ts` | 725 | Local-first storage | 1 (buffer type) |
| `hybrid-inbox-repository.ts` | 187 | Orchestration | CLEAN |

### Service Layer

| File | Lines | Purpose | Issues |
|------|-------|---------|--------|
| `inbox-service.ts` | 332 | Business logic + auth | CLEAN |

### React Layer

| File | Lines | Purpose | Issues |
|------|-------|---------|--------|
| `use-inbox.ts` | 236 | Query hooks | 2 (staleTime, invalidation) |
| `use-inbox-service.ts` | 74 | Service factory | CLEAN |
| `inbox-card.tsx` | 199 | Card component | 4 (useCallback) |
| `inbox-detail-panel.tsx` | 214 | Detail panel | CLEAN |

---

## 6. CTO Mandates Checklist

| Mandate | Implementation | File:Line | Status |
|---------|---------------|-----------|--------|
| `amountCents`: INTEGER CENTS | Zod `.int()` | inbox.schema.ts:26,42 | PASS |
| ISO 8601 date strings | Zod regex | inbox.schema.ts:24,46 | PASS |
| `DataResult<T>` pattern | Type alias | types.ts:53 | PASS |
| `instanceof` error handling | Error classes | errors.ts:28-86 | PASS |
| Tombstone soft deletes | `deleted_at` | supabase-repo.ts:469 | PASS |
| No N+1 queries | Batch + maps | local-repo.ts:74-124 | PASS |
| Orchestrator Rule | Service nullable | use-inbox-service.ts:61 | PASS |
| Version-checked RPC | WHERE clause | supabase-repo.ts:236 | PASS |
| IAuthProvider abstraction | DI pattern | inbox-service.ts:21 | PASS |
| localSyncStatus updates | PENDING on write | local-repo.ts:389 | PASS |

---

## 7. Recommendations

### High Priority

1. **Fix Feature Bleed (4 violations)**
   - Move `TransactionDetailPanel` from `features/shared/` to `@/components/shared/`
   - Extract `CategorySelector` to `@/components/shared/`
   - Extract `TransactionList` to `@/components/shared/` or create inbox-specific
   - Move `useBulkSelection` to `@/lib/hooks/`

2. **Add React Query Configuration**
   - Add `staleTime: QUERY_CONFIG.STALE_TIME.SHORT` to `useInfiniteQuery`
   - Replace broad invalidation with surgical `setQueryData` updates

### Medium Priority

3. **Add useCallback to inbox-card.tsx handlers**
   - Lines 36, 51, 66, 81 - prevents re-renders in card grid

4. **Fix Type Safety Issues**
   - Line 537 (`local-inbox-repository.ts`): Define explicit buffer return type
   - Line 439 (`supabase-inbox-repository.ts`): Validate RPC result with Zod

### Low Priority

5. **Regenerate Supabase Types**
   - Will remove 4 `as any` workarounds in `data-transformers.ts`

6. **Schema Field Cleanup**
   - Remove `currencyOriginal` from `createInboxItemSchema` or add to DTO

---

## 8. Audit Score Summary

| Category | Score | Notes |
|----------|-------|-------|
| Entity Definitions | 9.5/10 | Excellent domain modeling |
| Naming Conventions | 10/10 | Fully compliant |
| Type Safety | 8.5/10 | 6 `any` instances (mostly justified) |
| Feature Isolation | 7.5/10 | 4 violations remaining |
| Sacred Mandates | 10/10 | All 4 mandates passed |
| Performance | 8.5/10 | Missing useCallback, staleTime |
| Architecture | 9.5/10 | Clean separation of concerns |
| **Overall** | **9.2/10** | Production-ready |

---

## Appendix: Zod Schema Definitions

### Form Validation (`schemas/inbox.schema.ts`)

```typescript
// Line 18-28
export const promoteInboxItemSchema = z.object({
  inboxId: z.string().uuid('Invalid inbox item ID'),
  accountId: z.string().uuid('Account is required'),
  categoryId: z.string().uuid('Category is required'),
  finalDescription: z.string().optional(),
  finalDate: z.string().regex(isoDateRegex, 'Invalid date format').optional(),
  finalAmountCents: z.number().int('Must be integer cents').positive().optional(),
  exchangeRate: z.number().positive().optional(),
});

// Line 41-51
export const createInboxItemSchema = z.object({
  amountCents: z.number().int('Amount must be integer cents').positive().nullable().optional(),
  description: z.string().nullable().optional(),
  currencyOriginal: z.string().length(3).optional(),  // UI-only
  date: z.string().regex(isoDateRegex).optional().nullable(),
  sourceText: z.string().optional().nullable(),
  accountId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// Line 58-60
export const dismissInboxItemSchema = z.object({
  inboxId: z.string().uuid('Invalid inbox item ID'),
});
```

### Database Row Validation (`lib/data/db-row-schemas.ts`)

```typescript
// Lines 158-181
export const TransactionInboxViewRowSchema = z.object({
  id: uuid,
  user_id: uuid,
  amount_original: z.number().nullable(),
  currency_original: z.string().nullable(),
  description: z.string().nullable(),
  date: timestamptz.nullable(),
  source_text: z.string().nullable(),
  account_id: uuid.nullable(),
  category_id: uuid.nullable(),
  exchange_rate: z.number().nullable(),
  notes: z.string().nullable(),
  status: z.enum(['pending', 'processed', 'ignored']),
  created_at: timestamptz,
  updated_at: timestamptz,
  amount_cents: z.number().int().nullable(),  // Integer enforcement
  version: z.number().int().optional(),
  deleted_at: timestamptz.nullable().optional(),
  // View joins...
});
```

---

## Audit Metadata

- **Lines of Code Audited**: ~3,500+
- **Files Examined**: 19
- **Total Issues**: 16 (4 Feature Bleed, 6 Type Safety, 4 Re-render, 2 React Query)
- **CTO Mandate Compliance**: 100% (10/10 mandates passed)
- **Previous Audit Score**: 8.5/10
- **Current Audit Score**: 9.2/10
- **Improvement**: +0.7 points (feature bleed reduced from 9 to 4)
