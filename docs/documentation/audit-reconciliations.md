# Composable Manifest: features/reconciliations

> **Audit Version**: 3.0 (Comprehensive)
> **Audit Date**: 2026-01-31
> **Previous Audits**: 2026-01-28 (v1), 2026-01-30 (v2)
> **Auditor**: Senior Systems Architect
> **Scope**: `/features/reconciliations/` folder + orchestration layer

---

## Executive Summary

| Category | Status | Details |
|----------|--------|---------|
| Variable & Entity Registry | **PASS** | 4 feature files, clean domain separation |
| Naming Audit | **PASS** | camelCase domain, snake_case DB |
| Type Safety | **PASS** | No naked `any`, proper constraints |
| Dependency Manifest | **PASS** | 0 feature bleed violations |
| Transformer Check | **PASS** | Uses `@/lib/data/data-transformers` |
| Integer Cents | **PASS** | BIGINT cents, `toCents()`/`fromCents()` |
| Sync Integrity | **PASS** | `version` column + trigger |
| Soft Deletes | **PASS** | Tombstone pattern with RPC |
| Auth Abstraction | **PASS** | Uses `IAuthProvider` interface |
| React Compiler | **PASS** | Uses `useWatch`, no `watch()` |
| Re-render Optimization | **PASS** | Smart invalidation, no polling |

**Overall Result: ALL SACRED MANDATES COMPLIANT**

---

## 1. Variable & Entity Registry

### 1.1 Feature File Inventory

**Total Files**: 4 (828 lines)

| File | Lines | Purpose |
|------|-------|---------|
| [api/reconciliations.ts](features/reconciliations/api/reconciliations.ts) | 254 | Service layer: CRUD, RPC operations, soft delete |
| [hooks/use-reconciliations.ts](features/reconciliations/hooks/use-reconciliations.ts) | 15 | Re-export shim (deprecated) |
| [components/settings/reconciliation-settings.tsx](features/reconciliations/components/settings/reconciliation-settings.tsx) | 258 | Settings UI: list, delete, finalize |
| [components/settings/reconciliation-form-modal.tsx](features/reconciliations/components/settings/reconciliation-form-modal.tsx) | 301 | Create/Edit modal with form |

**Orchestration Layer** (outside feature):

| File | Lines | Purpose |
|------|-------|---------|
| [lib/hooks/use-reconciliations.ts](lib/hooks/use-reconciliations.ts) | 268 | React Query hooks (orchestrator) |

### 1.2 Entity Inventory

**Feature-Local Types:**

| Name | Kind | File | Line |
|------|------|------|------|
| `ReconciliationFormData` | type | `reconciliation-form-modal.tsx` | 45 |
| `ReconciliationFormModalProps` | interface | `reconciliation-form-modal.tsx` | 47 |
| `ReconciliationsService` | class | `api/reconciliations.ts` | 19 |

**Domain Types (Sacred Domain):**

| Name | Kind | File | Line |
|------|------|------|------|
| `Reconciliation` | interface | [domain/reconciliations.ts](domain/reconciliations.ts#L62) | 62 |
| `ReconciliationWithAccount` | interface | [domain/reconciliations.ts](domain/reconciliations.ts#L112) | 112 |
| `ReconciliationSummary` | interface | [domain/reconciliations.ts](domain/reconciliations.ts#L132) | 132 |
| `ReconciliationStatus` | type | [domain/reconciliations.ts](domain/reconciliations.ts#L27) | 27 |
| `isDraftReconciliation()` | type guard | [domain/reconciliations.ts](domain/reconciliations.ts#L159) | 159 |
| `isCompletedReconciliation()` | type guard | [domain/reconciliations.ts](domain/reconciliations.ts#L168) | 168 |
| `isDeletedReconciliation()` | type guard | [domain/reconciliations.ts](domain/reconciliations.ts#L177) | 177 |

**Zod Schemas (Boundary Validation):**

| Schema | Purpose | File | Line |
|--------|---------|------|------|
| `ReconciliationRowSchema` | Database row validation | [db-row-schemas.ts](lib/data/db-row-schemas.ts#L235) | 235 |
| `ReconciliationSummaryRpcSchema` | RPC response validation | [db-row-schemas.ts](lib/data/db-row-schemas.ts#L287) | 287 |
| `LinkUnlinkRpcSchema` | Bulk operation RPC | [db-row-schemas.ts](lib/data/db-row-schemas.ts#L299) | 299 |

### 1.3 Naming Audit

| Convention | Expected | Actual | Status |
|------------|----------|--------|--------|
| Domain objects | camelCase | `beginningBalance`, `endingBalance`, `deletedAt` | **PASS** |
| Database columns | snake_case | `beginning_balance_cents`, `ending_balance_cents`, `deleted_at` | **PASS** |
| React hooks | `use*` prefix | `useReconciliations`, `useDeleteReconciliation` | **PASS** |
| Type guards | `is*` prefix | `isDraftReconciliation`, `isCompletedReconciliation` | **PASS** |
| Query keys | Constant object | `QUERY_KEYS.RECONCILIATIONS.*` | **PASS** |
| Service factory | `create*` prefix | `createReconciliationsService` | **PASS** |

### 1.4 Type Safety Audit

| Pattern | Location | Assessment |
|---------|----------|------------|
| `Record<string, unknown>` | [api/reconciliations.ts:165](features/reconciliations/api/reconciliations.ts#L165) | **PASS** - Properly constrained RPC response |
| `step="any"` | [reconciliation-form-modal.tsx:206,219](features/reconciliations/components/settings/reconciliation-form-modal.tsx#L206) | **PASS** - HTML attribute, not TypeScript type |
| No naked `any` | All files | **PASS** - Grep returned 0 type violations |

---

## 2. Dependency Manifest (Import Audit)

### 2.1 Feature Bleed Check

**Result: NO VIOLATIONS**

| File | Imports From | Category | Status |
|------|-------------|----------|--------|
| `api/reconciliations.ts` | `@/lib/auth/*` | Auth abstraction | **ALLOWED** |
| `api/reconciliations.ts` | `@/lib/data/*` | Transformers, validation | **ALLOWED** |
| `api/reconciliations.ts` | `@/domain/reconciliations` | Domain types | **ALLOWED** |
| `reconciliation-settings.tsx` | `@/lib/hooks/use-reconciliations` | Orchestration layer | **ALLOWED** |
| `reconciliation-settings.tsx` | `@/lib/hooks/use-reference-data` | Orchestration layer | **ALLOWED** |
| `reconciliation-settings.tsx` | `@/lib/utils/cents-conversion` | Shared utility | **ALLOWED** |
| `reconciliation-settings.tsx` | `@/components/ui/*` | UI components | **ALLOWED** |
| `reconciliation-form-modal.tsx` | `@/lib/hooks/use-reconciliations` | Orchestration layer | **ALLOWED** |
| `reconciliation-form-modal.tsx` | `@/lib/hooks/use-reference-data` | Orchestration layer | **ALLOWED** |
| `reconciliation-form-modal.tsx` | `@/lib/utils/cents-conversion` | Shared utility | **ALLOWED** |

**No imports from other `features/*` folders.**

### 2.2 Architecture Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPONENTS LAYER                             │
│  reconciliation-settings.tsx  ←───  reconciliation-form-modal   │
│                    │                           │                │
│                    └───────────┬───────────────┘                │
│                                ▼                                │
├─────────────────────────────────────────────────────────────────┤
│                   ORCHESTRATION LAYER                           │
│           lib/hooks/use-reconciliations.ts                      │
│                                │                                │
│                                ▼                                │
├─────────────────────────────────────────────────────────────────┤
│                      SERVICE LAYER                              │
│         features/reconciliations/api/reconciliations.ts         │
│                                │                                │
│                                ▼                                │
├─────────────────────────────────────────────────────────────────┤
│                     DATA LAYER                                  │
│    lib/data/data-transformers.ts  ←  lib/data/db-row-schemas.ts │
│                                │                                │
│                                ▼                                │
├─────────────────────────────────────────────────────────────────┤
│                    DOMAIN LAYER                                 │
│              domain/reconciliations.ts                          │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Transformer Usage

| Transformer | Purpose | Usage Location |
|-------------|---------|----------------|
| `dbReconciliationToDomain()` | Row → Domain | `api/reconciliations.ts:73` |
| `dbReconciliationsToDomain()` | Rows → Domain[] | `api/reconciliations.ts:52` |
| `domainReconciliationToDbInsert()` | Domain → Insert | `api/reconciliations.ts:89` |
| `domainReconciliationToDbUpdate()` | Domain → Update | `api/reconciliations.ts:126` |
| `dbReconciliationSummaryToDomain()` | RPC → Domain | `api/reconciliations.ts:244` |

**All transformations use centralized transformers. No inline mapping logic.**

### 2.4 Deprecated Re-export Shim

```typescript
// features/reconciliations/hooks/use-reconciliations.ts
/**
 * @deprecated Import from @/lib/hooks/use-reconciliations instead.
 * This file re-exports from the orchestration layer for backward compatibility.
 */
export {
  useReconciliations,
  useReconciliation,
  // ... all 8 hooks
} from '@/lib/hooks/use-reconciliations';
```

**Pattern**: Feature hooks moved to orchestration layer (`lib/hooks/`). Feature-local shim provides backward compatibility.

---

## 3. Sacred Mandate Compliance

### 3.1 Integer Cents

**Status: PASS**

| Layer | Implementation | Evidence |
|-------|----------------|----------|
| **Database** | `BIGINT` columns | `beginning_balance_cents`, `ending_balance_cents` |
| **RPC** | BIGINT arithmetic | `v_difference_cents := v_ending_balance_cents - (v_beginning_balance_cents + v_linked_sum_cents)` |
| **Transformer** | `toSafeIntegerOrZero()` | [data-transformers.ts:856-857](lib/data/data-transformers.ts#L856) |
| **UI Input** | `toCents()` on submit | [reconciliation-form-modal.tsx:117-118](features/reconciliations/components/settings/reconciliation-form-modal.tsx#L117) |
| **UI Display** | `fromCents()` for edit | [reconciliation-form-modal.tsx:103-104](features/reconciliations/components/settings/reconciliation-form-modal.tsx#L103) |
| **UI Display** | `formatCents()` for list | [reconciliation-settings.tsx:180,190](features/reconciliations/components/settings/reconciliation-settings.tsx#L180) |

**Form Submission Flow:**
```typescript
// reconciliation-form-modal.tsx:115-119
const dataWithCents = {
  ...data,
  beginningBalance: toCents(data.beginningBalance),  // User input → cents
  endingBalance: toCents(data.endingBalance),        // User input → cents
};
```

**Zod Schema (Hardened):**
```typescript
// db-row-schemas.ts:240-241
beginning_balance_cents: z.number().int(),  // HARDENED: BIGINT cents
ending_balance_cents: z.number().int(),     // HARDENED: BIGINT cents
```

### 3.2 Sync Integrity (Version Column)

**Status: PASS**

| Requirement | Implementation |
|-------------|----------------|
| `version` column | Added via [20260129030000_reconciliations_sync_hardening.sql](supabase/migrations/20260129030000_reconciliations_sync_hardening.sql#L12) |
| Version trigger | `trigger_set_reconciliation_version` using `global_transaction_version` sequence |
| Domain type | `version: number` at [domain/reconciliations.ts:67](domain/reconciliations.ts#L67) |
| Zod schema | `...BaseSyncFields` includes `version: z.number().int().min(0)` |
| UI usage | `handleDelete(reconciliation.id, reconciliation.version)` |

### 3.3 Soft Deletes (Tombstone Pattern)

**Status: PASS**

| Requirement | Implementation |
|-------------|----------------|
| `deleted_at` column | Added via migration |
| Tombstone filter | `.is('deleted_at', null)` in `getAll()` and `getById()` |
| Soft delete RPC | `delete_reconciliation_with_version(id, version)` |
| Domain type | `deletedAt: string \| null` |
| Type guard | `isDeletedReconciliation()` function |
| Partial indexes | `idx_reconciliations_active_*` for O(1) filtering |

**Service Layer Tombstone Filter:**
```typescript
// api/reconciliations.ts:36-38
.is('deleted_at', null)  // Tombstone filter: only active reconciliations
```

**Version-Checked Soft Delete:**
```typescript
// api/reconciliations.ts:150-177
async delete(id: string, version: number): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await this.supabase.rpc('delete_reconciliation_with_version', {
    p_reconciliation_id: id,
    p_expected_version: version,
  });
  // ...
}
```

### 3.4 Auth Abstraction (IAuthProvider)

**Status: PASS**

| Requirement | Implementation |
|-------------|----------------|
| Interface used | `IAuthProvider` from `@/lib/auth/auth-provider.interface` |
| Implementation | `SupabaseAuthProvider` injected via factory |
| Direct Supabase auth | **NONE** in feature folder |
| Factory pattern | `createReconciliationsService()` handles DI |

**Service Constructor:**
```typescript
// api/reconciliations.ts:19-27
export class ReconciliationsService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly authProvider: IAuthProvider  // Abstraction
  ) {}

  private async getCurrentUserId(): Promise<string> {
    return this.authProvider.getCurrentUserId();  // Uses abstraction
  }
}
```

---

## 4. Performance & Scalability

### 4.1 React Compiler Check

**Status: PASS**

| Pattern | Location | Assessment |
|---------|----------|------------|
| `useWatch` (correct) | [reconciliation-form-modal.tsx:80,85,90](features/reconciliations/components/settings/reconciliation-form-modal.tsx#L80) | **PASS** |
| `watch()` (deprecated) | Not found | **PASS** |

**Correct Usage:**
```typescript
// reconciliation-form-modal.tsx:80-94
const dateStart = useWatch({
  control,
  name: 'dateStart',
  defaultValue: null,
});
const dateEnd = useWatch({ ... });
const accountId = useWatch({ ... });
```

### 4.2 Re-render Optimization

**Status: PASS**

| Aspect | Implementation |
|--------|----------------|
| Service memoization | `useMemo()` in `useReconciliationsService()` |
| Polling | **NONE** - CTO Directive followed |
| Query invalidation | Smart invalidation on mutation success |
| Heavy computations | None detected in hooks |

**No Polling Pattern (CTO Directive):**
```typescript
// lib/hooks/use-reconciliations.ts:73-81
export function useReconciliationSummary(reconciliationId: string | null | undefined) {
  // ...
  return useQuery({
    // ...
    // NO refetchInterval - invalidation handles updates
  });
}
```

### 4.3 Query Invalidation Strategy

| Mutation | Invalidates |
|----------|-------------|
| `useCreateReconciliation` | `ALL`, `BY_ACCOUNT` |
| `useUpdateReconciliation` | `ALL`, `BY_ACCOUNT`, `BY_ID`, `SUMMARY` |
| `useDeleteReconciliation` | `ALL`, `['transactions']` |
| `useLinkTransactions` | `SUMMARY`, `['transactions']` |
| `useUnlinkTransactions` | `ALL`, `['transactions']` |

### 4.4 Database Partial Indexes

| Index | Columns | Filter |
|-------|---------|--------|
| `idx_reconciliations_active` | `id` | `WHERE deleted_at IS NULL` |
| `idx_reconciliations_active_by_user` | `user_id` | `WHERE deleted_at IS NULL` |
| `idx_reconciliations_active_by_account` | `account_id` | `WHERE deleted_at IS NULL` |
| `idx_reconciliations_sync_version` | `user_id, version` | `WHERE deleted_at IS NULL` |

---

## 5. RPC Functions

### 5.1 RPC Inventory

| RPC Function | Purpose | Validation Schema |
|--------------|---------|-------------------|
| `link_transactions_to_reconciliation` | Atomic bulk link | `LinkUnlinkRpcSchema` |
| `unlink_transactions_from_reconciliation` | Atomic bulk unlink | `LinkUnlinkRpcSchema` |
| `get_reconciliation_summary` | Real-time math (BIGINT) | `ReconciliationSummaryRpcSchema` |
| `delete_reconciliation_with_version` | Version-checked soft delete | Manual JSONB parsing |

### 5.2 Delete RPC Error Handling

| Error Code | UI Message | Trigger |
|------------|------------|---------|
| `version_conflict` | "This reconciliation was modified. Please refresh and try again." | Concurrent edit |
| `reconciliation_completed` | "Cannot delete a completed reconciliation. Change status to draft first." | Business rule |
| `not_found` | "Reconciliation not found or already deleted." | Already deleted |
| `concurrent_modification` | Generic error | Race condition |

---

## 6. UI Components

### 6.1 ReconciliationSettings Component

**Purpose**: Settings page list view with CRUD actions

**Features:**
- List all reconciliations with account info
- Status badges (Draft/Locked)
- Balance display using `formatCents()`
- Delete with version check
- Finalize/Revert status toggle
- Resume/View audit button (TODO: navigation)

**State Management:**
```typescript
const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
const [editingReconciliation, setEditingReconciliation] = useState<string | null>(null);
```

### 6.2 ReconciliationFormModal Component

**Purpose**: Create/Edit reconciliation form

**Features:**
- Account selector (disabled during edit)
- Name input with validation
- Balance inputs with `toCents()` conversion
- Date range pickers (optional)
- Zod schema validation

**Form Schema:**
```typescript
const reconciliationSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  name: z.string().min(1, 'Name is required'),
  beginningBalance: z.number(),
  endingBalance: z.number(),
  dateStart: z.string().nullable().optional(),
  dateEnd: z.string().nullable().optional(),
});
```

---

## 7. Migration Timeline

| Migration | Date | Purpose |
|-----------|------|---------|
| `20260109000001_create_reconciliations_table.sql` | 2026-01-09 | Initial table (NUMERIC balances) |
| `20260109000002_add_reconciliation_to_transactions.sql` | 2026-01-09 | FK to transactions |
| `20260109000004_create_reconciliation_rpcs.sql` | 2026-01-09 | Link/unlink/summary RPCs |
| `20260109000005_update_transactions_view_reconciliation.sql` | 2026-01-09 | View updates |
| `20260110000001_add_reconciliation_status_to_view.sql` | 2026-01-10 | Status in view |
| `20260129030000_reconciliations_sync_hardening.sql` | 2026-01-29 | Add version/deleted_at |
| `20260129030001_reconciliation_version_ops.sql` | 2026-01-29 | Version-checked delete RPC |
| `20260129030002_reconciliations_tombstone_indexes.sql` | 2026-01-29 | Partial indexes |
| `20260130000002_reconciliations_bigint.sql` | 2026-01-30 | BIGINT cents conversion |

---

## 8. Swift Mirror (iOS Sync Readiness)

**Status: READY**

```swift
struct ReconciliationEntity: Codable {
    let id: String
    let version: Int
    let userId: String
    let accountId: String
    let name: String
    let beginningBalance: Int  // INTEGER CENTS
    let endingBalance: Int     // INTEGER CENTS
    let dateStart: String?
    let dateEnd: String?
    let status: ReconciliationStatus
    let createdAt: String
    let updatedAt: String
    let deletedAt: String?
}
```

---

## 9. Audit Comparison

| Aspect | v1 (01-28) | v2 (01-30) | v3 (01-31) |
|--------|------------|------------|------------|
| Sync Integrity | **FAIL** | **PASS** | **PASS** |
| Soft Deletes | **FAIL** | **PASS** | **PASS** |
| Integer Cents | PASS | PASS | **PASS** (BIGINT hardened) |
| Feature Bleed | PASS | PASS | **PASS** |
| Auth Abstraction | PASS | PASS | **PASS** |
| React Compiler | PASS | PASS | **PASS** (`useWatch`) |
| Components | None | None | **2 new components** |
| Orchestration | In-feature | In-feature | **Moved to lib/hooks** |
| DB Columns | `beginning_balance` | `beginning_balance` | `beginning_balance_cents` |
| Lines of Code | 461 | 508 | **828** |

---

## 10. File Inventory (Complete)

### Feature Files

| File | Lines | Purpose |
|------|-------|---------|
| `features/reconciliations/api/reconciliations.ts` | 254 | Service layer |
| `features/reconciliations/hooks/use-reconciliations.ts` | 15 | Deprecated re-export |
| `features/reconciliations/components/settings/reconciliation-settings.tsx` | 258 | Settings list UI |
| `features/reconciliations/components/settings/reconciliation-form-modal.tsx` | 301 | Form modal UI |
| **Feature Total** | **828** | |

### Supporting Files (Outside Feature)

| File | Lines | Purpose |
|------|-------|---------|
| `lib/hooks/use-reconciliations.ts` | 268 | Orchestration layer hooks |
| `domain/reconciliations.ts` | 180 | Domain types + guards |
| `lib/data/db-row-schemas.ts` | ~70 | Zod schemas (partial) |
| `lib/data/data-transformers.ts` | ~110 | Transformers (partial) |

### Migrations

| Count | Total |
|-------|-------|
| Reconciliation migrations | 9 |

---

## 11. Conclusion

**ALL SACRED MANDATES COMPLIANT**

The reconciliations feature demonstrates:

1. **Integer Cents**: BIGINT storage + `toCents()`/`fromCents()` at UI boundary
2. **Sync Integrity**: `version` column with `global_transaction_version` sequence
3. **Soft Deletes**: Tombstone pattern with version-checked RPC
4. **Auth Abstraction**: Clean `IAuthProvider` interface usage
5. **Type Safety**: Zod validation at all boundaries, no naked `any`
6. **Performance**: `useWatch` pattern, no polling, smart invalidation
7. **Architecture**: Proper layering (Service → Orchestration → UI)

**iOS Sync Ready**:
- Version-based optimistic concurrency control
- Tombstone propagation for distributed sync
- Swift-serializable domain types with documentation
- BIGINT precision for mathematical determinism

**No Critical Issues.**

---

## Appendix: Query Keys

```typescript
const QUERY_KEYS = {
  RECONCILIATIONS: {
    ALL: ['reconciliations'],
    BY_ACCOUNT: (accountId) => ['reconciliations', 'account', accountId],
    BY_ID: (id) => ['reconciliations', id],
    SUMMARY: (id) => ['reconciliations', id, 'summary'],
  }
};
```
