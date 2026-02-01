# Reconciliations Feature Audit Report

**Audit Date**: 2026-02-01
**Auditor**: Claude Code
**Manifesto Version**: Latest
**Status**: PASS WITH WARNINGS
**Grade**: A-

---

## Executive Summary

| Metric | Result |
|--------|--------|
| Cross-Feature Violations | 1 (external to feature folder) |
| Zero-Any Violations | 0 |
| Spaghetti Violations | 0 |
| Ghost Props | 4 |
| Schema Drift | None |
| Integer Cents | PASS |
| Result Pattern | PARTIAL |
| Boundary Mapping | PASS |

---

## Section 1: Dependency Map

### 1.1 File Inventory

| File | Lines | Purpose |
|------|-------|---------|
| `features/reconciliations/api/reconciliations.ts` | 255 | Service/Repository class for CRUD operations |
| `features/reconciliations/components/settings/reconciliation-form-modal.tsx` | 302 | Modal form for create/edit reconciliation |
| `features/reconciliations/components/settings/reconciliation-settings.tsx` | 259 | Settings page for reconciliation management |
| `features/reconciliations/hooks/use-reconciliations.ts` | 16 | **DEPRECATED** - Re-export wrapper |

**Total**: 4 files, ~832 lines

---

### 1.2 External Package Imports

| Package | File | Usage |
|---------|------|-------|
| `@supabase/supabase-js` | api/reconciliations.ts:1 | SupabaseClient type |
| `react` | components/*.tsx | useEffect, useState |
| `react-hook-form` | reconciliation-form-modal.tsx:4 | useForm, useWatch |
| `@hookform/resolvers/zod` | reconciliation-form-modal.tsx:5 | zodResolver |
| `zod` | reconciliation-form-modal.tsx:6 | Schema validation |
| `date-fns` | Both components | format() for dates |
| `lucide-react` | reconciliation-settings.tsx:5 | Plus, Trash2, ShieldCheck, Clock, CheckCircle2, ArrowRight, DollarSign |

---

### 1.3 Project Imports (ALLOWED)

#### api/reconciliations.ts

| Import | Source | Purpose |
|--------|--------|---------|
| IAuthProvider | `@/lib/auth/auth-provider.interface` | Auth abstraction |
| createSupabaseAuthProvider | `@/lib/auth/supabase-auth-provider` | Auth factory |
| Reconciliation, ReconciliationSummary | `@/domain/reconciliations` | Domain types |
| db*ToDomain, domain*ToDb* | `@/lib/data/data-transformers` | Boundary mapping |
| validateOrThrow, validateArrayOrThrow | `@/lib/data/validate` | Zod validation |
| ReconciliationRowSchema, ReconciliationSummaryRpcSchema, LinkUnlinkRpcSchema | `@/lib/data/db-row-schemas` | Zod schemas |

#### reconciliation-form-modal.tsx

| Import | Source | Purpose |
|--------|--------|---------|
| Dialog, DialogContent, etc. | `@/components/ui/dialog` | UI primitives |
| Button | `@/components/ui/button` | UI primitive |
| Input | `@/components/ui/input` | UI primitive |
| Select, SelectContent, etc. | `@/components/ui/select` | UI primitive |
| Calendar | `@/components/ui/calendar` | Date picker |
| Popover, PopoverContent, PopoverTrigger | `@/components/ui/popover` | Dropdown container |
| useAccountsData | `@/lib/hooks/use-reference-data` | Account list |
| useCreateReconciliation, useUpdateReconciliation, useReconciliation | `@/lib/hooks/use-reconciliations` | Mutations/queries |
| cn | `@/lib/utils` | Class names |
| toCents, fromCents | `@/lib/utils/cents-conversion` | Cents conversion |

#### reconciliation-settings.tsx

| Import | Source | Purpose |
|--------|--------|---------|
| Button | `@/components/ui/button` | UI primitive |
| useReconciliations, useDeleteReconciliation, useUpdateReconciliation | `@/lib/hooks/use-reconciliations` | Queries/mutations |
| useAccountsData | `@/lib/hooks/use-reference-data` | Account list |
| ReconciliationFormModal | `./reconciliation-form-modal` | Relative import |
| cn | `@/lib/utils` | Class names |
| formatCents | `@/lib/utils/cents-conversion` | Display formatting |

---

### 1.4 Cross-Feature Import Violations

| Location | Import | Issue | Severity |
|----------|--------|-------|----------|
| `lib/hooks/use-bulk-selection.ts:27` | `@/features/reconciliations/hooks/use-reconciliations` | Imports from deprecated feature file instead of `@/lib/hooks/use-reconciliations` | HIGH |

**Note**: This violation is external to the feature folder but imports from it.

---

## Section 2: Schema Compliance

### 2.1 ReconciliationRowSchema vs Supabase Types

**Location**: `lib/data/db-row-schemas.ts:234-247`

| Field | Zod Schema | Supabase Type | Match |
|-------|------------|---------------|-------|
| `id` | `uuid` | `string` | YES |
| `user_id` | `uuid` | `string` | YES |
| `account_id` | `uuid` | `string` | YES |
| `name` | `z.string()` | `string` | YES |
| `beginning_balance_cents` | `z.number().int()` | `number` | YES |
| `ending_balance_cents` | `z.number().int()` | `number` | YES |
| `date_start` | `z.string().nullable()` | `string \| null` | YES |
| `date_end` | `z.string().nullable()` | `string \| null` | YES |
| `status` | `ReconciliationStatusEnum` | `reconciliation_status` | YES |
| `created_at` | `timestamptz` | `string` | YES |
| `updated_at` | `timestamptz` | `string` | YES |
| `version` | `z.number().int().min(0)` | `number` | YES |
| `deleted_at` | `z.string().nullable()` | `string \| null` | YES |

**Status**: ALIGNED

---

### 2.2 ReconciliationSummaryRpcSchema

**Location**: `lib/data/db-row-schemas.ts:286-293`

| Field | Zod Schema | RPC Return Type | Match |
|-------|------------|-----------------|-------|
| `beginningBalanceCents` | `z.number().int()` | `bigint` | YES |
| `endingBalanceCents` | `z.number().int()` | `bigint` | YES |
| `linkedSumCents` | `z.number().int()` | `bigint` | YES |
| `linkedCount` | `z.number().int()` | `integer` | YES |
| `differenceCents` | `z.number().int()` | `bigint` | YES |
| `isBalanced` | `z.boolean()` | `boolean` | YES |

**Status**: ALIGNED

---

### 2.3 Form Schema (Local)

**Location**: `reconciliation-form-modal.tsx:36-43`

```typescript
const reconciliationSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  name: z.string().min(1, 'Name is required'),
  beginningBalance: z.number(),  // Decimal input, converted via toCents()
  endingBalance: z.number(),     // Decimal input, converted via toCents()
  dateStart: z.string().nullable().optional(),
  dateEnd: z.string().nullable().optional(),
});
```

**Note**: Form accepts decimal input which is converted to cents at submission boundary (line 117-118).

---

## Section 3: Entity Audit (Ghost Prop Audit)

### 3.1 Reconciliation Entity

**Location**: `domain/reconciliations.ts:62-104`

| Property | Type | UI Component Usage | Business Logic Usage | Status |
|----------|------|-------------------|---------------------|--------|
| `id` | `string` | `reconciliation-settings.tsx:117` (key), `reconciliation-form-modal.tsx:123` (mutation) | CRUD, cache keys | **ACTIVE** |
| `version` | `number` | `reconciliation-settings.tsx:202` (delete arg) | Optimistic concurrency control | **ACTIVE** |
| `userId` | `string` | **NONE** | RLS context only (api/reconciliations.ts:87) | **GHOST** |
| `accountId` | `string` | `reconciliation-settings.tsx:112` (account lookup), `reconciliation-form-modal.tsx:100` | Filter, association | **ACTIVE** |
| `name` | `string` | `reconciliation-settings.tsx:142` (title), `reconciliation-form-modal.tsx:101` | Create/Update | **ACTIVE** |
| `beginningBalance` | `number` | `reconciliation-settings.tsx:180` (formatCents), `reconciliation-form-modal.tsx:103` | Reconciliation math | **ACTIVE** |
| `endingBalance` | `number` | `reconciliation-settings.tsx:191` (formatCents), `reconciliation-form-modal.tsx:104` | Reconciliation math | **ACTIVE** |
| `dateStart` | `string \| null` | `reconciliation-settings.tsx:150` (format), `reconciliation-form-modal.tsx:105` | Date filtering | **ACTIVE** |
| `dateEnd` | `string \| null` | `reconciliation-settings.tsx:151` (format), `reconciliation-form-modal.tsx:106` | Date filtering | **ACTIVE** |
| `status` | `ReconciliationStatus` | `reconciliation-settings.tsx:113,167` (badge, buttons) | Lock/unlock logic | **ACTIVE** |
| `createdAt` | `string` | **NONE** | Entity construction only | **GHOST** |
| `updatedAt` | `string` | **NONE** | Entity construction only | **GHOST** |
| `deletedAt` | `string \| null` | **NONE** | Tombstone filter (api/reconciliations.ts:37,64) | **ACTIVE (Sync)** |

---

### 3.2 ReconciliationWithAccount Entity

**Location**: `domain/reconciliations.ts:112-121`

| Property | Type | UI Component Usage | Business Logic Usage | Status |
|----------|------|-------------------|---------------------|--------|
| *(inherits Reconciliation)* | - | - | - | - |
| `accountName` | `string` | **NONE** | **NONE** | **GHOST** |
| `accountColor` | `string` | **NONE** | **NONE** | **GHOST** |
| `accountCurrency` | `string` | **NONE** | **NONE** | **GHOST** |

**Finding**: The `ReconciliationWithAccount` interface is defined but **never used**. The settings component manually looks up account data via `accounts.find()` (line 112) instead of using a joined view.

---

### 3.3 ReconciliationSummary Entity

**Location**: `domain/reconciliations.ts:132-150`

| Property | Type | UI Component Usage | Business Logic Usage | Status |
|----------|------|-------------------|---------------------|--------|
| `beginningBalance` | `number` | HUD display (external) | Math calculation | **ACTIVE** |
| `endingBalance` | `number` | HUD display (external) | Math calculation | **ACTIVE** |
| `linkedSum` | `number` | HUD display (external) | Running total | **ACTIVE** |
| `linkedCount` | `number` | Transaction count (external) | Progress indicator | **ACTIVE** |
| `difference` | `number` | Gap display (external) | Balance validation | **ACTIVE** |
| `isBalanced` | `boolean` | Success indicator (external) | Completion check | **ACTIVE** |

**Note**: ReconciliationSummary is used in the audit HUD (external to this feature folder).

---

### 3.4 Ghost Props Summary

| Property | Entity | Reason | Recommendation |
|----------|--------|--------|----------------|
| `userId` | Reconciliation | RLS-only, never displayed | Add `@internal` JSDoc |
| `createdAt` | Reconciliation | Audit trail, never displayed | Consider displaying in detail view |
| `updatedAt` | Reconciliation | Audit trail, never displayed | Consider displaying in detail view |
| `ReconciliationWithAccount` | Extended Interface | Entire interface unused | Remove or implement JOIN query |

---

## Section 4: Spaghetti Report

### 4.1 Component Analysis

| Component | File | Direct DB Calls | Business Logic Leakage | Status |
|-----------|------|-----------------|----------------------|--------|
| ReconciliationFormModal | reconciliation-form-modal.tsx | None | Zod form schema (acceptable) | **CLEAN** |
| ReconciliationSettings | reconciliation-settings.tsx | None | `accounts.find()` (UI-specific) | **CLEAN** |

---

### 4.2 Data Flow Verification

```
ReconciliationSettings (UI)
    ↓ useReconciliations() query
@/lib/hooks/use-reconciliations (Orchestrator)
    ↓ createReconciliationsService()
features/reconciliations/api/reconciliations.ts (Service)
    ↓ Supabase queries + Zod validation
lib/data/data-transformers.ts (Boundary Mapping)
    ↓ dbReconciliationToDomain()
domain/reconciliations.ts (Domain Entity)
```

**Status**: COMPLIANT

---

### 4.3 Cents Conversion Boundary

| Operation | Location | Function | Correct |
|-----------|----------|----------|---------|
| Form display | reconciliation-form-modal.tsx:103-104 | `fromCents()` | YES |
| Form submit | reconciliation-form-modal.tsx:117-118 | `toCents()` | YES |
| List display | reconciliation-settings.tsx:180,191 | `formatCents()` | YES |

**Status**: HARDENED

---

## Section 5: Manifesto Compliance

| Rule | Status | Evidence |
|------|--------|----------|
| Integer Cents | PASS | All balances use `z.number().int()`, converted via `toCents()`/`fromCents()` |
| Result Pattern | PARTIAL | Service throws errors instead of returning `DataResult<T>`. Exception: `delete()` returns `{ success, error? }` |
| Zero-Any Mandate | PASS | No `any`, `as any`, or `@ts-ignore` found |
| Boundary Mapping | PASS | All transformations via `lib/data/data-transformers.ts` |
| Cross-Feature Imports | PASS* | Feature folder is clean; violation exists externally in `lib/hooks/use-bulk-selection.ts` |
| Tombstone Pattern | PASS | Uses `deleted_at` field, filtered in queries (lines 37, 64) |
| Version-Based OCC | PASS | Uses `version` field for delete with version check (line 150) |

---

## Section 6: Recommendations

### P1 - High Priority

#### 1. Fix Cross-Feature Import Violation

**File**: `lib/hooks/use-bulk-selection.ts:27`

```typescript
// Change from:
import { useLinkTransactions, useUnlinkTransactions } from '@/features/reconciliations/hooks/use-reconciliations';

// To:
import { useLinkTransactions, useUnlinkTransactions } from '@/lib/hooks/use-reconciliations';
```

#### 2. Delete Deprecated Re-export File

**File**: `features/reconciliations/hooks/use-reconciliations.ts`

This 16-line file only re-exports from `@/lib/hooks/use-reconciliations` and is marked `@deprecated`. Delete after fixing the import in `use-bulk-selection.ts`.

---

### P2 - Medium Priority

#### 3. Migrate ReconciliationsService to DataResult Pattern

**File**: `features/reconciliations/api/reconciliations.ts`

Current pattern (throws):
```typescript
if (error) {
  throw new Error(error.message || 'Failed to fetch reconciliations');
}
```

Recommended pattern (returns DataResult):
```typescript
if (error) {
  return { success: false, data: null, error: new Error(error.message) };
}
return { success: true, data: validated };
```

#### 4. Decide on ReconciliationWithAccount Entity

**Options**:
- **Option A**: Remove the unused interface from `domain/reconciliations.ts`
- **Option B**: Create a view query in the service that JOINs account data and returns `ReconciliationWithAccount`

---

### P3 - Low Priority

#### 5. Add JSDoc Annotations to Ghost Props

```typescript
/** @internal Used for RLS, not displayed in UI */
readonly userId: string;

/** @future Consider displaying for audit trail visibility */
readonly createdAt: string;

/** @future Consider displaying for audit trail visibility */
readonly updatedAt: string;
```

#### 6. Consider Audit Trail Display

Display `createdAt` in reconciliation detail view for transparency.

---

## Appendix: File Inventory

| File Path | Lines | Last Modified |
|-----------|-------|---------------|
| features/reconciliations/api/reconciliations.ts | 255 | - |
| features/reconciliations/components/settings/reconciliation-form-modal.tsx | 302 | - |
| features/reconciliations/components/settings/reconciliation-settings.tsx | 259 | - |
| features/reconciliations/hooks/use-reconciliations.ts | 16 | DEPRECATED |
| lib/hooks/use-reconciliations.ts | ~150 | Orchestrator |
| domain/reconciliations.ts | 180 | Domain |
| lib/data/db-row-schemas.ts | Lines 234-306 | Schemas |
| lib/data/data-transformers.ts | Lines 817-958 | Transformers |
