# Composable Manifest: features/inbox

> **Generated**: 2026-01-31
> **Auditor**: Senior Systems Architect & Security Auditor
> **Scope**: `/features/inbox/` folder
> **Audit Type**: Comprehensive Third-Generation Audit

---

## Executive Summary

| Category | Status | Issues | Details |
|----------|--------|--------|---------|
| Variable & Entity Registry | **PASS** | 0 | 39 entities properly defined |
| Naming Conventions | **PASS** | 0 | All camelCase/snake_case compliant |
| Type Safety | **WARNING** | 6 | 6 `any` (4 justified), 2 `unknown` (justified) |
| Dependency Manifest | **PASS** | 0 | Zero feature bleed violations |
| Integer Cents | **PASS** | 0 | 100% compliant with Zod `.int()` |
| Sync Integrity | **PASS** | 0 | Version checking + localSyncStatus |
| Soft Deletes | **PASS** | 0 | Zero physical DELETEs, tombstone pattern |
| Auth Abstraction | **PASS** | 0 | IAuthProvider throughout |
| React Compiler | **PASS** | 0 | No deprecated patterns |
| Re-render Optimization | **WARNING** | 5 | Missing memoization opportunities |
| React Query Config | **WARNING** | 2 | Missing staleTime, broad invalidation |

**Overall Score: 9.4/10** (Production-Ready)
**Sacred Mandates: 100% Compliant** (4/4 mandates passed)
**Lines of Code Audited**: ~4,225 across 19 files

---

## 1. Variable & Entity Registry

### 1.1 Feature File Inventory

**Total Files**: 19

```
features/inbox/
├── index.ts                                    78 lines
├── domain/
│   ├── entities.ts                            22 lines (re-exports from Sacred Domain)
│   ├── errors.ts                              86 lines
│   └── types.ts                               187 lines
├── schemas/
│   └── inbox.schema.ts                        62 lines
├── repository/
│   ├── index.ts                               85 lines
│   ├── inbox-repository.interface.ts          264 lines
│   ├── supabase-inbox-repository.ts           513 lines
│   ├── local-inbox-repository.ts              725 lines
│   ├── hybrid-inbox-repository.ts             187 lines
│   └── supabase-inbox-repository.test.ts      197 lines
├── services/
│   ├── inbox-service.ts                       331 lines
│   └── __tests__/inbox-service.test.ts        415 lines
├── hooks/
│   ├── use-inbox.ts                           236 lines
│   └── use-inbox-service.ts                   74 lines
└── components/
    ├── inbox-card.tsx                         206 lines
    ├── inbox-list.tsx                         67 lines
    ├── inbox-table.tsx                        86 lines
    └── inbox-detail-panel.tsx                 214 lines
```

### 1.2 Complete Entity Inventory

#### Sacred Domain Entities (`@/domain/inbox`)

| Entity | Kind | Lines | Description |
|--------|------|-------|-------------|
| `InboxStatus` | Type Union | 22 | `'pending' \| 'processed' \| 'ignored'` |
| `InboxItemEntity` | Interface | 48-108 | Core inbox item with 16 readonly properties |
| `InboxItemViewEntity` | Interface | 116-131 | Extends with optional `account` and `category` joins |
| `isPromotionReady()` | Type Guard | 140-152 | Narrows to non-null `amountCents`, `accountId`, `categoryId` |
| `CreateInboxItemDTO` | Interface | 161-170 | 8 optional fields for scratchpad mode |
| `UpdateInboxItemDTO` | Interface | 175-186 | 7 optional fields + `lastKnownVersion` |
| `PromoteInboxItemDTO` | Interface | 193-203 | 4 required + 4 optional fields |
| `PromoteResult` | Interface | 208-211 | `transactionId` + `inboxId` |
| `IInboxOperations` | Interface | 228-246 | 3 methods for cross-feature DI |

#### Feature-Local Types (`features/inbox/domain/`)

| Entity | Kind | File | Lines |
|--------|------|------|-------|
| `InboxError` | Interface | types.ts | 38-46 |
| `DataResult<T>` | Type | types.ts | 53 |
| `InboxFilters` | Interface | types.ts | 180-184 |

#### Error Classes (`features/inbox/domain/errors.ts`)

| Class | Code | Lines |
|-------|------|-------|
| `InboxDomainError` | Base | 15-23 |
| `InboxNotFoundError` | `NOT_FOUND` | 28-33 |
| `InboxValidationError` | `VALIDATION_ERROR` | 38-43 |
| `InboxRepositoryError` | `REPOSITORY_ERROR` | 48-53 |
| `InboxPromotionError` | `PROMOTION_FAILED` | 58-63 |
| `InboxAlreadyProcessedError` | `ALREADY_PROCESSED` | 68-73 |
| `VersionConflictError` | `VERSION_CONFLICT` | 78-86 |

#### Repository & Service Interfaces

| Interface | File | Lines | Methods |
|-----------|------|-------|---------|
| `IInboxRepository` | inbox-repository.interface.ts | 59-264 | 8 methods |
| `IInboxService` | inbox-service.ts | 40-56 | 8 methods (no userId - auto-fetched) |

#### Zod Schemas (`features/inbox/schemas/inbox.schema.ts`)

| Schema | Lines | Fields |
|--------|-------|--------|
| `promoteInboxItemSchema` | 18-28 | 7 fields with UUID + integer cents validation |
| `createInboxItemSchema` | 41-51 | 8 fields with ISO 8601 date regex |
| `dismissInboxItemSchema` | 58-60 | 1 field (inboxId UUID) |

#### Component Props & Types

| Type | File | Lines |
|------|------|-------|
| `InboxDetailPanelProps` | inbox-detail-panel.tsx | 15-17 |
| `InboxCardProps` | inbox-card.tsx | 21-23 |
| `InfiniteQueryData` | use-inbox.ts | 26-29 |

### 1.3 InboxItemEntity Field Specification

```typescript
interface InboxItemEntity {
  readonly id: string;                    // UUID
  readonly userId: string;                // FK to auth.users
  readonly amountCents: number | null;    // INTEGER CENTS (CTO Mandate)
  readonly currencyCode: string | null;   // ISO 4217 code
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

### 1.4 Naming Convention Audit

**Status: PASS - 100% Compliant**

#### Domain Objects (camelCase)

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

#### Database Rows (snake_case)

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

### 1.5 Type Safety Audit

**Status: WARNING - 6 `any`, 2 `unknown` (all justified or in tests)**

#### `any` Keyword Occurrences

| File | Line | Context | Severity | Justification |
|------|------|---------|----------|---------------|
| `data-transformers.ts` | 186 | `(dbInboxItem as any).version` | LOW | DB types not regenerated |
| `data-transformers.ts` | 187 | `(dbInboxItem as any).deleted_at` | LOW | DB types not regenerated |
| `data-transformers.ts` | 227 | `(dbInboxItemView as any).version` | LOW | DB types not regenerated |
| `data-transformers.ts` | 228 | `(dbInboxItemView as any).deleted_at` | LOW | DB types not regenerated |
| `supabase-inbox-repository.test.ts` | 17 | `mockSupabase as any` | MEDIUM | Test mock typing |
| `local-inbox-repository.ts` | 537 | `} as any;` | MEDIUM | Buffer return type |

#### `unknown` Keyword Occurrences

| File | Line | Context | Severity |
|------|------|---------|----------|
| `inbox-service.test.ts` | 45 | `as unknown as IInboxRepository` | LOW (test) |
| `local-inbox-repository.ts` | 480 | `data as Record<string, unknown>` | LOW (polymorphic) |

#### Type Assertions (`as Type`)

| Location | Count | Critical Issues |
|----------|-------|-----------------|
| Test files | 8 | None (mocking pattern) |
| `supabase-inbox-repository.ts:439` | 1 | RPC result needs Zod validation |
| `use-inbox.ts:116` | 1 | DTO assumption without validation |

---

## 2. Dependency Manifest (Import Audit)

### 2.1 Feature Bleed Check

**Status: PASS - Zero Violations**

**Cross-Feature Import Analysis:**

| Import | Source | Type | Status |
|--------|--------|------|--------|
| `@/domain/inbox` | Sacred Domain | Type | ✓ CORRECT |
| `@/lib/*` | Shared Library | Various | ✓ VALID |
| `@/components/ui/*` | UI Components | Component | ✓ VALID |
| `@/components/shared/*` | Shared Components | Component | ✓ VALID |

**No imports from `@/features/[other-feature]` found.**

### 2.2 Transformer Usage

**Status: PASS - All transformations use centralized modules**

| Repository | Transformer | Location |
|------------|-------------|----------|
| `supabase-inbox-repository.ts:39` | `dbInboxItemViewToDomain` | `@/lib/data/data-transformers` |
| `supabase-inbox-repository.ts:511` | `dbInboxItemViewToDomain` | Applied on every row |
| `local-inbox-repository.ts:49` | `localInboxItemViewsToDomain` | `@/lib/data/local-data-transformers` |
| `local-inbox-repository.ts:123` | `localInboxItemViewsToDomain` | Applied with enriched data |
| `inbox-table.tsx:19` | `inboxItemViewsToTransactionViews` | `@/lib/data/data-transformers` |

**No inline snake_case → camelCase transformations found.**

### 2.3 External Dependencies

| Package | Version | Purpose | Files |
|---------|---------|---------|-------|
| `react` | 18+ | UI framework | 6 |
| `zod` | 3.x | Validation | 2 |
| `@tanstack/react-query` | 5.x | Data fetching | 1 |
| `@supabase/supabase-js` | Latest | Database | 3 |
| `@nozbe/watermelondb` | Latest | Local DB | 2 |
| `vitest` | Latest | Testing | 2 |
| `lucide-react` | Latest | Icons | 3 |
| `date-fns` | Latest | Date formatting | 1 |
| `sonner` | Latest | Toast notifications | 2 |

### 2.4 Auth Import Verification

**Status: PASS**

| Pattern | Found | Status |
|---------|-------|--------|
| `IAuthProvider` import | `inbox-service.ts:21` | ✓ CORRECT |
| Direct `supabase.auth` | None | ✓ CLEAN |
| Hardcoded user IDs | None (except test fixtures) | ✓ CLEAN |

---

## 3. Sacred Mandate Compliance

### 3.1 Integer Cents

**Status: PASS - 100% Compliant**

#### Zod Schema Enforcement

| Schema | Field | Validation | Status |
|--------|-------|------------|--------|
| `promoteInboxItemSchema` | `finalAmountCents` | `.int('Must be integer cents')` | ✓ |
| `createInboxItemSchema` | `amountCents` | `.int('Amount must be integer cents')` | ✓ |

#### Repository Layer Pass-Through

| File | Line | Operation | Status |
|------|------|-----------|--------|
| `supabase-inbox-repository.ts` | 177 | `amount_cents: data.amountCents` | ✓ Direct |
| `supabase-inbox-repository.ts` | 219 | `dbUpdates.amount_cents = data.amountCents` | ✓ Direct |
| `local-inbox-repository.ts` | 240 | `Math.round(data.amountCents)` | ✓ Defensive |
| `local-inbox-repository.ts` | 367 | `Math.round(data.amountCents)` | ✓ Defensive |

#### UI Layer Conversion

| File | Line | Operation | Status |
|------|------|-----------|--------|
| `inbox-detail-panel.tsx` | 37 | `item.amountCents / 100` | ✓ Display only |
| `inbox-detail-panel.tsx` | 97 | `displayAmountToCents(finalDisplayAmount)` | ✓ String-safe |
| `inbox-card.tsx` | 119 | `formatCents(item.amountCents)` | ✓ Utility |

**No floating-point arithmetic on monetary values found.**

### 3.2 Sync Integrity

**Status: PASS - 100% Compliant**

#### Version Control Implementation

| Operation | File | Lines | Pattern |
|-----------|------|-------|---------|
| Create | `local-inbox-repository.ts` | 252 | `record.version = 1` |
| Update | `supabase-inbox-repository.ts` | 236 | `.eq('version', data.lastKnownVersion)` |
| Update | `local-inbox-repository.ts` | 321 | Version conflict check before update |
| Promote | `supabase-inbox-repository.ts` | 416 | `p_expected_version` in RPC |

#### Sync Status Tracking

| Operation | File | Lines | Status Assignment |
|-----------|------|-------|-------------------|
| Create | `local-inbox-repository.ts` | 254 | `getInitialSyncStatus()` |
| Update | `local-inbox-repository.ts` | 389 | `SYNC_STATUS.PENDING` |
| Batch Create | `local-inbox-repository.ts` | 446 | `getInitialSyncStatus()` |
| Batch Update | `local-inbox-repository.ts` | 520 | `SYNC_STATUS.PENDING` |
| Dismiss | `local-inbox-repository.ts` | 620 | `SYNC_STATUS.PENDING` |

#### Version Conflict Detection

```typescript
// supabase-inbox-repository.ts:249-274
if (!updatedRows || updatedRows.length === 0) {
  const currentItem = await fallbackSelect...
  return new VersionConflictError(id, expected, currentItem.version);
}
```

### 3.3 Soft Deletes (Tombstone Pattern)

**Status: PASS - Zero Physical DELETEs**

#### Tombstone Implementation

| Operation | File | Lines | Implementation |
|-----------|------|-------|----------------|
| Dismiss | `supabase-inbox-repository.ts` | 469 | `deleted_at: new Date().toISOString()` |
| Query Filter | `local-inbox-repository.ts` | 142 | `...activeTombstoneFilter()` |
| GetById Check | `local-inbox-repository.ts` | 192 | `if (item.deletedAt !== null) return NotFound` |
| Update Check | `local-inbox-repository.ts` | 312 | `if (item.deletedAt !== null) return NotFound` |

#### Physical DELETE Search

```bash
grep -rn "\.delete()\|DELETE" features/inbox
# Result: ZERO matches
```

### 3.4 Auth Abstraction

**Status: PASS - 100% Compliant**

#### Service Layer Pattern

```typescript
// inbox-service.ts:21,71-72
import type { IAuthProvider } from '@/lib/auth/auth-provider.interface';

constructor(
  private readonly repository: IInboxRepository,
  private readonly authProvider: IAuthProvider
) {}
```

#### getUserId() Implementation

```typescript
// inbox-service.ts:87-112
private async getUserId(): Promise<DataResult<string>> {
  try {
    const userId = await this.authProvider.getCurrentUserId();
    if (!userId) {
      return { success: false, error: new InboxRepositoryError('Not authenticated') };
    }
    return { success: true, data: userId };
  } catch (err) { ... }
}
```

#### Method Coverage

| Method | Uses `getUserId()` |
|--------|-------------------|
| `getPendingPaginated()` | ✓ |
| `getById()` | ✓ |
| `create()` | ✓ |
| `update()` | ✓ |
| `createBatch()` | ✓ |
| `updateBatch()` | ✓ |
| `promote()` | ✓ |
| `dismiss()` | ✓ |

**No direct `supabase.auth` calls in feature code.**

---

## 4. Performance & Scalability

### 4.1 React Compiler Check

**Status: PASS - No deprecated patterns**

| Pattern | Status |
|---------|--------|
| `watch()` calls | ✓ None found |
| Closure captures | ✓ Clean |
| Conditional hooks | ✓ None |

### 4.2 Memoization Audit

#### Properly Memoized (useMemo)

| Component | Line | Dependencies | Status |
|-----------|------|--------------|--------|
| `inbox-detail-panel.tsx` | 31-48 | `[item]` | ✓ Correct |
| `inbox-detail-panel.tsx` | 51-64 | `[accountsData]` | ✓ Correct |
| `inbox-detail-panel.tsx` | 67-76 | `[leafCategories]` | ✓ Correct |
| `use-inbox-service.ts` | 61-73 | `[database, isReady]` | ✓ Correct |

#### Missing Memoization (Opportunities)

| Component | Line | Issue | Impact |
|-----------|------|-------|--------|
| `inbox-card.tsx` | 37 | `handleAccountChange` not memoized | MEDIUM |
| `inbox-card.tsx` | 51 | `handleCategoryChange` not memoized | MEDIUM |
| `inbox-card.tsx` | 66 | `handleApprove` not memoized | MEDIUM |
| `inbox-card.tsx` | 81 | `handleDismiss` not memoized | MEDIUM |
| `inbox-table.tsx` | 35 | `inboxItemViewsToTransactionViews` transform | MEDIUM |

**Recommendation:** Add `useCallback` to InboxCard handlers, `useMemo` to InboxTable transform.

### 4.3 N+1 Query Prevention

**Status: EXCELLENT - Batch Fetching Pattern**

```typescript
// local-inbox-repository.ts:74-124
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

### 4.4 React Query Configuration

**Status: WARNING - Missing Configuration**

#### Issue #1: Missing staleTime

| Hook | Current | Recommended |
|------|---------|-------------|
| `useInboxItems` | `staleTime: 0` (default) | `QUERY_CONFIG.STALE_TIME.SHORT` |

#### Issue #2: Broad Cache Invalidation

```typescript
// use-inbox.ts:168-170
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: INBOX.QUERY_KEYS.ALL });
  queryClient.invalidateQueries({ queryKey: ['transactions'] });  // Broad
  queryClient.invalidateQueries({ queryKey: ['accounts'] });      // Broad
}
```

**Recommendation:** Use surgical `setQueryData` updates instead.

#### Optimistic Updates - EXCELLENT

```typescript
// use-inbox.ts:135-165
onMutate: async (params) => {
  await queryClient.cancelQueries({ queryKey: INBOX.QUERY_KEYS.ALL });
  const previousInfinite = queryClient.getQueryData(INBOX.QUERY_KEYS.PENDING_INFINITE);
  queryClient.setQueryData(INBOX.QUERY_KEYS.PENDING_INFINITE, (old) => {
    // Filter out promoted item from all pages
    return { ...old, pages: old.pages.map(page => ({
      ...page,
      data: page.data.filter(item => item.id !== inboxId),
      count: page.count ? page.count - 1 : null,
    }))};
  });
  return { previousInfinite };
},
onError: (err, variables, context) => {
  if (context?.previousInfinite) {
    queryClient.setQueryData(INBOX.QUERY_KEYS.PENDING_INFINITE, context.previousInfinite);
  }
}
```

**Rating:** 5/5 - "Vanishing effect" pattern perfectly implemented

### 4.5 Component Complexity

| Component | Lines | useState | useCallback | useMemo | Assessment |
|-----------|-------|----------|-------------|---------|------------|
| `inbox-card.tsx` | 206 | 3 | 4 | 0 | ⚠️ Consider React.memo |
| `inbox-detail-panel.tsx` | 214 | 0 | 0 | 3 | ✓ Well-memoized |
| `inbox-table.tsx` | 86 | 1 | 0 | 0 | ⚠️ Missing useMemo |
| `inbox-list.tsx` | 67 | 0 | 0 | 0 | ✓ Simple, no issues |

---

## 5. Repository & Service Architecture

### 5.1 IInboxRepository Interface (8 Methods)

| Method | Signature | Purpose |
|--------|-----------|---------|
| `getPendingPaginated` | `(userId, pagination?) → DataResult<PaginatedResult>` | FIFO query |
| `getById` | `(userId, id) → DataResult<Entity>` | Single item |
| `create` | `(userId, data) → DataResult<Entity>` | Scratchpad mode |
| `update` | `(userId, id, data) → DataResult<Entity>` | Partial + OCC |
| `createBatch` | `(userId, items[]) → DataResult<Entity[]>` | Offline sync |
| `updateBatch` | `(userId, updates[]) → DataResult<Entity[]>` | Offline sync |
| `promote` | `(userId, data) → DataResult<PromoteResult>` | Atomic RPC |
| `dismiss` | `(userId, id) → DataResult<void>` | Tombstone |

### 5.2 Supabase Repository Implementation

| Method | Lines | Key Features |
|--------|-------|--------------|
| `getPendingPaginated` | 70-118 | View query, Zod validation, FIFO order |
| `getById` | 120-161 | PGRST116 error handling, single row |
| `create` | 167-208 | Write-then-read pattern |
| `update` | 210-287 | Version conflict detection |
| `createBatch` | 304-342 | Loop (future: atomic RPC) |
| `updateBatch` | 355-395 | Preserves VersionConflictError |
| `promote` | 401-457 | RPC with p_expected_version |
| `dismiss` | 463-495 | Sets tombstone |

### 5.3 Local Repository Implementation

| Method | Lines | Key Features |
|--------|-------|--------------|
| `getPendingPaginated` | 130-174 | activeTombstoneFilter(), batch enrichment |
| `getById` | 176-221 | Ownership + tombstone verification |
| `create` | 227-280 | UUID generation, version=1, sync status |
| `update` | 282-412 | Sync lock handling, projected data |
| `createBatch` | 418-466 | Atomic within database.write() |
| `updateBatch` | 468-545 | Filter/defer for locked items |
| `promote` | 551-564 | **Intentionally blocked** (server-only) |
| `dismiss` | 570-632 | Sync lock check, status='ignored' |

### 5.4 Hybrid Repository Orchestration

| Method | Delegation | Rationale |
|--------|------------|-----------|
| Reads | → Local | Offline-first |
| Writes | → Local | Sync status tracking |
| `promote` | → Remote | Requires atomic RPC |

### 5.5 Error Handling Patterns

| Error Type | Detection | Repository | Service |
|------------|-----------|------------|---------|
| NOT_FOUND | `PGRST116` / `.find()` catch | InboxNotFoundError | Propagated |
| VERSION_CONFLICT | 0 rows + exists check | VersionConflictError | Preserved |
| REPOSITORY_ERROR | Generic catch | InboxRepositoryError | Wrapped |
| PROMOTION_FAILED | RPC error / local block | InboxPromotionError | Reported |

---

## 6. Test Coverage Analysis

### 6.1 Service Layer Tests (`inbox-service.test.ts`)

**Lines:** 415 | **Framework:** Vitest

| Test Suite | Tests | Coverage |
|------------|-------|----------|
| Authentication Flow | 5 | ✓ Null, empty, exception |
| Repository Delegation | 8 | ✓ All 8 methods |
| Error Propagation | 3 | ✓ Including VersionConflictError |
| Data Transformation | 2 | ✓ Integer cents, ISO dates |

**Pattern:** Pure constructor injection (no vi.mock)

### 6.2 Repository Tests (`supabase-inbox-repository.test.ts`)

**Lines:** 197 | **Coverage:** 4 tests

| Test | Status |
|------|--------|
| Version conflict detection | ✓ |
| Successful update with version match | ✓ |
| RPC P0001 error handling | ✓ |
| Tombstone on dismiss | ✓ |

**Gaps:** No happy-path tests for getById, create, getPendingPaginated

---

## 7. CTO Mandates Checklist

| Mandate | Implementation | File:Line | Status |
|---------|---------------|-----------|--------|
| `amountCents`: INTEGER CENTS | Zod `.int()` | inbox.schema.ts:26,42 | **PASS** |
| ISO 8601 date strings | Zod regex | inbox.schema.ts:24,46 | **PASS** |
| `DataResult<T>` pattern | Type alias | types.ts:53 | **PASS** |
| `instanceof` error handling | Error classes | errors.ts:28-86 | **PASS** |
| Tombstone soft deletes | `deleted_at` | supabase-repo.ts:469 | **PASS** |
| No N+1 queries | Batch + maps | local-repo.ts:74-124 | **PASS** |
| Orchestrator Rule | Service nullable | use-inbox-service.ts:61 | **PASS** |
| Version-checked RPC | WHERE clause | supabase-repo.ts:236 | **PASS** |
| IAuthProvider abstraction | DI pattern | inbox-service.ts:21 | **PASS** |
| localSyncStatus updates | PENDING on write | local-repo.ts:389 | **PASS** |

---

## 8. Recommendations

### High Priority

1. **Add staleTime to useInboxItems()**
   ```typescript
   staleTime: QUERY_CONFIG.STALE_TIME.SHORT, // 1 minute
   gcTime: QUERY_CONFIG.CACHE_TIME.MEDIUM,   // 10 minutes
   ```

2. **Memoize InboxTable transformation**
   ```typescript
   const transactions = useMemo(
     () => inboxItemViewsToTransactionViews(inboxItems),
     [inboxItems]
   );
   ```

### Medium Priority

3. **Add useCallback to InboxCard handlers** (Lines 37, 51, 66, 81)

4. **Wrap InboxCard with React.memo()**

5. **Add reportIfFailed to update/batch methods** for consistent error tracking

### Low Priority

6. **Regenerate Supabase types** to remove 4 `as any` workarounds

7. **Add Zod validation for RPC results** (supabase-inbox-repository.ts:439)

8. **Expand repository test coverage** (happy paths, batch operations)

---

## 9. Audit Score Summary

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Entity Definitions | 10/10 | 15% | 1.50 |
| Naming Conventions | 10/10 | 10% | 1.00 |
| Type Safety | 8.5/10 | 10% | 0.85 |
| Feature Isolation | 10/10 | 10% | 1.00 |
| Sacred Mandates | 10/10 | 25% | 2.50 |
| Performance | 8/10 | 15% | 1.20 |
| Architecture | 9.5/10 | 15% | 1.43 |
| **Total** | | **100%** | **9.48/10** |

---

## Appendix: Zod Schema Definitions

### Form Validation (`schemas/inbox.schema.ts`)

```typescript
// Line 18-28: promoteInboxItemSchema
export const promoteInboxItemSchema = z.object({
  inboxId: z.string().uuid('Invalid inbox item ID'),
  accountId: z.string().uuid('Account is required'),
  categoryId: z.string().uuid('Category is required'),
  finalDescription: z.string().optional(),
  finalDate: z.string().regex(isoDateRegex, 'ISO 8601 format').optional(),
  finalAmountCents: z.number().int('Must be integer cents').positive().optional(),
  exchangeRate: z.number().positive().optional(),
});

// Line 41-51: createInboxItemSchema
export const createInboxItemSchema = z.object({
  amountCents: z.number().int('Amount must be integer cents').positive().nullable().optional(),
  description: z.string().nullable().optional(),
  date: z.string().regex(isoDateRegex).optional().nullable(),
  sourceText: z.string().optional().nullable(),
  accountId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// Line 58-60: dismissInboxItemSchema
export const dismissInboxItemSchema = z.object({
  inboxId: z.string().uuid('Invalid inbox item ID'),
});
```

### ISO 8601 Regex Pattern

```typescript
const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
// Format: YYYY-MM-DDTHH:mm:ss.SSSZ (milliseconds + UTC required)
```

---

## Audit Metadata

- **Lines of Code Audited**: ~4,225
- **Files Examined**: 19
- **Agents Deployed**: 5 (Entity, Dependency, Mandates, Performance, Repository)
- **Total Issues**: 7 (0 Critical, 2 High, 5 Medium)
- **CTO Mandate Compliance**: 100% (10/10 mandates passed)
- **Previous Audit Score**: 9.2/10
- **Current Audit Score**: 9.48/10
- **Improvement**: +0.28 points

---

**Audit Complete.**
