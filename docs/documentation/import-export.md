# Composable Manifest: features/import-export

> **Generated**: 2026-02-01
> **Auditor**: Claude (Senior Systems Architect)
> **Scope**: `/features/import-export/` folder
> **Status**: PASS WITH EXCEPTION
> **Grade**: A-

---

## Executive Summary

| Metric | Result |
|--------|--------|
| Cross-Feature Violations | 1 (EXCEPTION documented) |
| Zero-Any Violations | 0 |
| Spaghetti Violations | 1 (MINOR) |
| Ghost Props | 0 (no local entities) |
| Schema Drift | None |
| Integer Cents | PASS (`amountCents / 100` at export) |
| DataResult Pattern | PARTIAL (export throws on error) |
| Boundary Mapping | PASS (`validateOrThrow` at RPC boundary) |

---

## 1. Dependency Map

### 1.1 File Inventory

```
features/import-export/
└── services/
    ├── data-export-service.ts  (57 lines)
    └── data-import-service.ts  (116 lines)
```

**Total Files**: 2 (no barrel export index.ts, no components/hooks/domain)

**Note**: This is a minimal feature. Integration happens via `features/settings/components/data-management.tsx`.

### 1.2 Import Categories

#### External Packages (NPM)

| Package | Usage |
|---------|-------|
| `xlsx` | Excel file parsing (`read`, `utils`) and generation (`writeFile`) |
| `@supabase/supabase-js` | `SupabaseClient` type |

#### Project Imports - ALLOWED

| Import Source | Files Using | Purpose |
|---------------|-------------|---------|
| `@/lib/auth/auth-provider.interface` | 2 | `IAuthProvider` type |
| `@/lib/constants` | 1 | `ACCOUNT`, `CATEGORY`, `IMPORT_EXPORT` constants |
| `@/lib/data/validate` | 1 | `validateOrThrow` boundary validation |
| `@/lib/data/db-row-schemas` | 1 | `ImportResultRpcSchema` Zod schema |

#### Cross-Feature Imports - VIOLATION

| Import Source | File | Line | Purpose |
|---------------|------|------|---------|
| `@/features/transactions/repository` | `data-export-service.ts` | 4 | `createTransactionRepository` factory |

### 1.3 Cross-Feature Violation Analysis

**File**: `data-export-service.ts:4`
```typescript
import { createTransactionRepository } from '@/features/transactions/repository';
```

**Usage**: Creates `ITransactionRepository` to call `getAllPaginated()` for export data.

**Verdict**: **EXCEPTION - DOCUMENTED JUSTIFICATION**

**Justification**:
1. Export is an inherently cross-cutting concern that requires transaction data
2. Uses repository interface only (not implementation internals)
3. Repository is injected via factory pattern (dependency injection)
4. No feasible alternative without significant over-engineering

**Recommendation**: Add exception comment to source file:
```typescript
// EXCEPTION: Cross-feature import justified - export is inherently cross-cutting.
// Uses ITransactionRepository interface only (not implementation internals).
```

---

## 2. Schema Compliance

### 2.1 Zod Schema Definition

**File**: `lib/data/db-row-schemas.ts` (lines 311-315)

```typescript
export const ImportResultRpcSchema = z.object({
  success: z.number().int().min(0),
  failed: z.number().int().min(0),
  errors: z.array(z.string()),
});
```

### 2.2 Supabase RPC Definition

**File**: `types/supabase.ts` (lines 887-907)

```typescript
import_transactions: {
  Args: {
    p_default_account_color: string
    p_default_category_color: string
    p_transactions: Json
    p_user_id: string
    p_general_label?: string        // Optional i18n
    p_uncategorized_label?: string  // Optional i18n
  }
  Returns: Json
}
```

### 2.3 Schema Compliance Matrix

| Field | Zod Schema | RPC Returns | Match |
|-------|------------|-------------|-------|
| `success` | `z.number().int().min(0)` | `Json` (JSONB) | PASS |
| `failed` | `z.number().int().min(0)` | `Json` (JSONB) | PASS |
| `errors` | `z.array(z.string())` | `Json` (JSONB) | PASS |

### 2.4 Boundary Validation

**File**: `data-import-service.ts:104`
```typescript
const rpcResult = validateOrThrow(ImportResultRpcSchema, data, 'ImportResultRpc');
```

**Finding**: PASS - Proper boundary validation at RPC response.

---

## 3. Entity Audit (Ghost Prop Audit)

### 3.1 Local Entities

**Finding**: No local domain entities in `features/import-export/`. The feature uses:
- `TransactionViewEntity` from `@/domain/transactions` (via repository)
- Local interfaces `ImportResult` and `ImportRow` defined inline

### 3.2 TransactionViewEntity Properties Used in Export

**File**: `data-export-service.ts:33-42`

| Property | Type | Used | Excel Column | Status |
|----------|------|------|--------------|--------|
| `date` | `string` | YES | "Date" | **ACTIVE** |
| `amountCents` | `number` | YES | "Amount" (converted) | **ACTIVE** |
| `description` | `string \| null` | YES | "Description" | **ACTIVE** |
| `categoryName` | `string \| null` | YES | "Category" | **ACTIVE** |
| `accountName` | `string` | YES | "Account" | **ACTIVE** |
| `currencyOriginal` | `string` | YES | "Currency" | **ACTIVE** |
| `exchangeRate` | `number` | YES | "Exchange Rate" | **ACTIVE** |
| `notes` | `string \| null` | YES | "Notes" | **ACTIVE** |

### 3.3 TransactionViewEntity Properties NOT Used in Export

| Property | Type | Justification |
|----------|------|---------------|
| `id` | `string` | Internal identifier |
| `userId` | `string` | Auth context |
| `accountId` | `string` | Internal FK (name is exported) |
| `categoryId` | `string \| null` | Internal FK (name is exported) |
| `version` | `number` | Sync field |
| `amountHomeCents` | `number` | Redundant for export |
| `transferId` | `string \| null` | Internal linkage |
| `reconciliationId` | `string \| null` | Internal linkage |
| `cleared` | `boolean` | Reconciliation state |
| `accountColor` | `string \| null` | UI-only |
| `categoryColor` | `string \| null` | UI-only |
| `categoryType` | `string \| null` | Internal categorization |
| `reconciliationStatus` | `string \| null` | Internal state |
| `sourceText` | `string \| null` | Inbox origin |
| `inboxId` | `string \| null` | Internal linkage |
| `createdAt` | `string` | Audit timestamp |
| `updatedAt` | `string` | Audit timestamp |
| `deletedAt` | `string \| null` | Tombstone (filtered) |

**Finding**: PASS - Export uses 8 of 24 properties. Unused properties are appropriately internal identifiers, sync fields, or UI-specific display properties.

---

## 4. Local Spaghetti Report

### 4.1 Service Layer Analysis

#### data-export-service.ts

| Aspect | Lines | Pattern | Status |
|--------|-------|---------|--------|
| Repository Pattern | 22-23 | `createTransactionRepository()` | **CLEAN** |
| Error Handling | 25-27 | Throws on `!result.success` | **ACCEPTABLE** |
| Cents Conversion | 35 | `t.amountCents / 100` | **CLEAN** |
| File Generation | 44-54 | xlsx library | **CLEAN** |

#### data-import-service.ts

| Aspect | Lines | Pattern | Status |
|--------|-------|---------|--------|
| File Parsing | 41-49 | xlsx library | **CLEAN** |
| Date Conversion | 59-87 | Excel serial → ISO string | **CLEAN** |
| Field Validation | 75-78 | Constants-based errors | **CLEAN** |
| RPC Call | 92-99 | Supabase rpc() | **CLEAN** |
| Boundary Validation | 104 | `validateOrThrow()` | **CLEAN** |

### 4.2 Integration Component Analysis

**File**: `features/settings/components/data-management.tsx`

| Handler | Lines | Pattern | Status |
|---------|-------|---------|--------|
| Import | 87-115 | Dynamic import → Service delegation | **CLEAN** |
| Export | 176-184 | Dynamic import → Service delegation | **CLEAN** |
| Clear Data | 34-56 | Direct RPC call | **MINOR VIOLATION** |

#### Spaghetti Finding: handleClearData (lines 34-56)

```typescript
const handleClearData = async () => {
    const userId = await authProvider.getCurrentUserId();
    const { error } = await supabase.rpc('clear_user_data', { p_user_id: userId });
    // ... query invalidation
};
```

**Verdict**: MINOR SPAGHETTI

**Analysis**:
- Direct RPC call in component bypasses service layer
- However: single atomic operation, no complex orchestration
- `clear_user_data` is settings-specific, not import/export-specific

**Recommendation**: Consider extracting to `DataManagementService` for consistency, but low priority.

### 4.3 Spaghetti Summary

| Violation Type | Count | Location | Severity |
|----------------|-------|----------|----------|
| Direct Supabase RPC in component | 1 | `data-management.tsx:38` | MINOR |
| Business logic in component | 0 | - | - |
| Data transformation in component | 0 | - | - |

---

## 5. Rule Compliance Summary

### 5.1 Integer Cents Only

**Status**: PASS

**Evidence**: `data-export-service.ts:35`
```typescript
Amount: t.amountCents / 100, // Convert integer cents to decimal
```

Export correctly converts integer cents to human-readable decimals for Excel output.

**Import Side**: The `import_transactions` RPC receives decimal amounts from Excel and converts to cents internally.

### 5.2 Result Pattern (DataResult<T>)

**Status**: PARTIAL

| Operation | Return Type | Compliance |
|-----------|-------------|------------|
| Export | `void` (throws on error) | PARTIAL |
| Import | `ImportResult` | PASS |

**Note**: Export service throws on repository failure rather than returning `DataResult`. This is acceptable for UI-triggered operations with immediate feedback.

### 5.3 Zero-Any Policy

**Status**: PASS

**Evidence**: Grep search confirmed 0 matches for:
- `any`
- `as any`
- `@ts-ignore`

### 5.4 Boundary Mapping

**Status**: PASS

**Evidence**: `data-import-service.ts:104`
```typescript
const rpcResult = validateOrThrow(ImportResultRpcSchema, data, 'ImportResultRpc');
```

Proper Zod validation at RPC response boundary.

---

## 6. Recommendations

### 6.1 Immediate Actions (P3)

| Action | File | Effort |
|--------|------|--------|
| Add exception comment for cross-feature import | `data-export-service.ts:4` | Low |

### 6.2 Future Improvements (P4)

| Action | File | Effort |
|--------|------|--------|
| Extract `clear_user_data` to service | `data-management.tsx` | Low |
| Add barrel export index.ts | `features/import-export/` | Low |
| Consider returning `DataResult` from export | `data-export-service.ts` | Medium |

### 6.3 No Action Required

| Item | Reason |
|------|--------|
| Zero-Any violations | None found |
| Boundary validation | Already correct |
| Cents conversion | Already correct |
| Ghost props | N/A (no local entities) |

---

## 7. Appendix: File References

| File | Lines | Purpose |
|------|-------|---------|
| `features/import-export/services/data-export-service.ts` | 57 | Excel export with cents conversion |
| `features/import-export/services/data-import-service.ts` | 116 | Excel import with boundary validation |
| `features/settings/components/data-management.tsx` | 241 | Integration UI component |
| `lib/data/db-row-schemas.ts:311-315` | - | `ImportResultRpcSchema` definition |
| `lib/constants/import-export.constants.ts` | - | Column specs, error messages, RPC config |
