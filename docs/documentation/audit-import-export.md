# Composable Manifest: features/import-export

> **Generated**: 2026-01-31
> **Auditor**: Senior Systems Architect & Security Auditor
> **Revision**: 3 (Comprehensive Audit)
> **Scope**: `/features/import-export/` folder

---

## Executive Summary

| Category | Status | Severity | Notes |
|----------|--------|----------|-------|
| Variable & Entity Registry | PASS | - | 4 entities, proper typing |
| Dependency Manifest | **FAIL** | MEDIUM | 1 feature bleed violation |
| Integer Cents | PASS | - | RPC hardened (2026-01-30) |
| Sync Integrity | PASS | - | Trigger-based versioning |
| Soft Deletes | PASS | - | No physical DELETE ops |
| Auth Abstraction | PASS | - | IAuthProvider used |
| Type Safety (Zod) | PASS | - | Network boundary validated |
| Performance | PASS | - | N/A (not React components) |

**Critical Issues**: 0
**Violations**: 1 (Feature Bleed)

---

## 1. Variable & Entity Registry

### 1.1 Folder Structure

```
features/import-export/
└── services/
    ├── data-export-service.ts    (56 lines)
    └── data-import-service.ts    (116 lines)

Total: 2 files, 172 lines
```

### 1.2 Entity Inventory

| Entity | Kind | File | Lines | Exported | Purpose |
|--------|------|------|-------|----------|---------|
| `ImportResult` | interface | data-import-service.ts | 8-13 | Yes | RPC response shape |
| `ImportRow` | interface | data-import-service.ts | 15-24 | No | Excel row mapping |
| `DataImportService` | class | data-import-service.ts | 26-116 | Yes | Excel → DB import |
| `DataExportService` | class | data-export-service.ts | 12-56 | Yes | DB → Excel export |

### 1.3 Interface Details

**ImportResult** ([data-import-service.ts:8-13](features/import-export/services/data-import-service.ts#L8-L13)):
```typescript
export interface ImportResult {
    total: number;      // Total rows processed
    success: number;    // Successfully imported
    failed: number;     // Failed to import
    errors: string[];   // Error messages per row
}
```

**ImportRow** ([data-import-service.ts:15-24](features/import-export/services/data-import-service.ts#L15-L24)):
```typescript
interface ImportRow {
    Date: string | number;       // Excel date (serial or string)
    Amount: number;              // Decimal amount (converted to cents by RPC)
    Description: string;
    Category: string;
    Account: string;
    Currency: string;            // ISO 4217 code
    'Exchange Rate'?: number;    // Optional, defaults to 1.0
    Notes?: string;              // Optional
}
```

### 1.4 Naming Audit

**Status**: COMPLIANT

| Convention | Context | Examples |
|------------|---------|----------|
| PascalCase | Classes/Interfaces | `DataImportService`, `ImportResult`, `ImportRow` |
| camelCase | Methods/Properties | `importFromExcel`, `exportToExcel`, `processedRows` |
| SCREAMING_SNAKE | Constants | `IMPORT_EXPORT.RPC.IMPORT_TRANSACTIONS` |
| snake_case | RPC Parameters | `p_user_id`, `p_transactions`, `p_default_account_color` |

### 1.5 Type Safety

**Status**: COMPLIANT

| Check | Status | Evidence |
|-------|--------|----------|
| No `any` types | PASS | Zero `any` usage in both files |
| No `unknown` types | PASS | Zero `unknown` usage |
| Zod validation | PASS | `validateOrThrow(ImportResultRpcSchema, data, 'ImportResultRpc')` at line 104 |
| Generic type inference | PASS | `utils.sheet_to_json<ImportRow>(sheet)` at line 49 |

---

## 2. Dependency Manifest

### 2.1 data-import-service.ts Imports

| Line | Import | Source | Category | Status |
|------|--------|--------|----------|--------|
| 1 | `read, utils` | `xlsx` | External | OK |
| 2 | `SupabaseClient` (type) | `@supabase/supabase-js` | External | OK |
| 3 | `IAuthProvider` (type) | `@/lib/auth/auth-provider.interface` | lib/ | COMPLIANT |
| 4 | `ACCOUNT, CATEGORY, IMPORT_EXPORT` | `@/lib/constants` | lib/ | COMPLIANT |
| 5 | `validateOrThrow` | `@/lib/data/validate` | lib/ | COMPLIANT |
| 6 | `ImportResultRpcSchema` | `@/lib/data/db-row-schemas` | lib/ | COMPLIANT |

**Verdict**: All imports from `lib/` or external packages. **COMPLIANT**.

### 2.2 data-export-service.ts Imports

| Line | Import | Source | Category | Status |
|------|--------|--------|----------|--------|
| 1 | `utils, writeFile` | `xlsx` | External | OK |
| 2 | `SupabaseClient` (type) | `@supabase/supabase-js` | External | OK |
| 3 | `IAuthProvider` (type) | `@/lib/auth/auth-provider.interface` | lib/ | COMPLIANT |
| 4 | `createTransactionRepository` | `@/features/transactions/repository` | features/ | **VIOLATION** |

### 2.3 Feature Bleed Analysis

**Status**: FAIL

**Violation V-001** ([data-export-service.ts:4](features/import-export/services/data-export-service.ts#L4)):
```typescript
import { createTransactionRepository } from '@/features/transactions/repository';
```

**Rule**: Features should only import from `lib/`, `components/shared`, or their own subfolders.

**Impact**: Creates coupling between `import-export` and `transactions` features.

**Remediation Options**:

| Option | Approach | Effort |
|--------|----------|--------|
| A (Recommended) | Inject `ITransactionRepository` via constructor | Low |
| B | Move `ITransactionRepository` interface to `lib/repositories/` | Medium |
| C | Create shared data access abstraction in `lib/` | High |

**Option A Implementation**:
```typescript
// data-export-service.ts
import type { ITransactionRepository } from '@/lib/repositories/transaction-repository.interface';

export class DataExportService {
    constructor(
        private readonly supabase: SupabaseClient,
        private readonly authProvider: IAuthProvider,
        private readonly transactionRepository: ITransactionRepository  // Injected
    ) {}
```

### 2.4 Transformer Check

**Status**: INLINE MAPPING (Acceptable)

| File | Lines | Pattern | Justification |
|------|-------|---------|---------------|
| data-export-service.ts | 33-42 | Domain → Excel row | Excel format differs from domain |
| data-import-service.ts | 59-87 | Excel date preprocessing | Excel serial date handling |

The inline mapping is acceptable because Excel column formats are distinct from domain transformers.

### 2.5 External Dependencies

| Package | Usage | Security Notes |
|---------|-------|----------------|
| `xlsx` | Excel read/write | Review for CVEs periodically |
| `@supabase/supabase-js` | Type import only | No runtime dependency |

---

## 3. Sacred Mandate Compliance

### 3.1 Integer Cents

**Status**: COMPLIANT (Fixed 2026-01-30)

**Migration**: [20260130000000_fix_import_transactions_bigint.sql](supabase/migrations/20260130000000_fix_import_transactions_bigint.sql)

**RPC Conversion** (Lines 196-197):
```sql
ROUND(v_amount * 100)::BIGINT,                         -- Convert decimal to cents
ROUND(v_amount * v_exchange_rate * 100)::BIGINT,       -- Convert to home cents
```

**Export Conversion** ([data-export-service.ts:35](features/import-export/services/data-export-service.ts#L35)):
```typescript
Amount: t.amountCents / 100, // Convert integer cents to decimal
```

**Flow**:
```
Import: Excel Decimal (10.50) → RPC ROUND()*100 → BIGINT 1050
Export: BIGINT 1050 → / 100 → Excel Decimal (10.50)
```

### 3.2 Sync Integrity

**Status**: COMPLIANT

**Mechanism**: `set_transaction_version_trigger` ([20260112000001_repository_pattern_prep.sql:57-59](supabase/migrations/20260112000001_repository_pattern_prep.sql#L57-L59))

```sql
CREATE TRIGGER set_transaction_version_trigger
BEFORE INSERT OR UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION set_transaction_version();
```

**Behavior**: Every INSERT/UPDATE automatically gets a monotonically increasing version number from `global_transaction_version` sequence.

### 3.3 Soft Deletes

**Status**: COMPLIANT

| Service | Operation Type | DELETE Statements |
|---------|---------------|-------------------|
| DataExportService | Read-only | None |
| DataImportService | Insert-only via RPC | None |
| import_transactions RPC | Insert-only | None |

**Tombstone Pattern**: `deleted_at` column exists on transactions table, views filter `WHERE deleted_at IS NULL`.

### 3.4 Auth Abstraction

**Status**: COMPLIANT

| File | Line | Pattern |
|------|------|---------|
| data-export-service.ts | 19 | `await this.authProvider.getCurrentUserId()` |
| data-import-service.ts | 89 | `await this.authProvider.getCurrentUserId()` |

**Interface**: `IAuthProvider` ([lib/auth/auth-provider.interface.ts](lib/auth/auth-provider.interface.ts))

**No direct** `supabase.auth.getUser()` calls.

---

## 4. Performance & Scalability

### 4.1 React Compiler Check

**Status**: N/A

Both files are TypeScript service classes, not React components:
- No `watch()` calls
- No `useWatch()` calls
- No `useEffect()` calls
- No `useMemo()` calls
- No hooks of any kind

### 4.2 RPC Performance Analysis

**import_transactions RPC**:

| Aspect | Value | Notes |
|--------|-------|-------|
| Statement Timeout | 5 minutes | `SET statement_timeout TO '300000'` |
| Processing Model | Row-by-row loop | `FOR v_transaction IN SELECT * FROM jsonb_array_elements(...)` |
| Error Handling | Per-row try/catch | Allows partial imports |
| Concurrency | ON CONFLICT upserts | Handles race conditions |
| Max Batch Size | Tested 3551 rows | Production verified |

**Optimization Opportunity**: For very large imports (10,000+ rows), consider converting to bulk INSERT with `unnest()`.

### 4.3 Export Performance

| Aspect | Value | Notes |
|--------|-------|-------|
| Page Size | 10,000 transactions | `{ offset: 0, limit: 10000 }` |
| Memory Model | Full dataset in memory | May need pagination for very large exports |

---

## 5. Code Quality Analysis

### 5.1 Error Handling

**data-import-service.ts**:
```typescript
// Line 110-112: Top-level error catch
} catch (error) {
    result.errors.push(IMPORT_EXPORT.ERRORS.FILE_PROCESSING_ERROR(
        error instanceof Error ? error.message : IMPORT_EXPORT.ERRORS.UNKNOWN_ERROR
    ));
}
```

**Pattern**: Graceful degradation with error accumulation (not fail-fast).

### 5.2 Null Safety

| Location | Pattern | Status |
|----------|---------|--------|
| data-import-service.ts:62 | `if (!row.Date) throw` | Null checked |
| data-import-service.ts:76-78 | Required field validation | Null checked |
| data-export-service.ts:36-41 | `|| ''` fallbacks | Null handled |

### 5.3 Constants Usage

All magic strings externalized to constants:

| Constant | Usage |
|----------|-------|
| `IMPORT_EXPORT.ERRORS.*` | Error messages |
| `IMPORT_EXPORT.RPC.*` | RPC names and params |
| `IMPORT_EXPORT.EXCEL.*` | Date conversion values |
| `ACCOUNT.DEFAULT_COLOR` | New account color |
| `CATEGORY.DEFAULT_COLOR` | New category color |

---

## 6. Supporting Files

### 6.1 Constants

**File**: [lib/constants/import-export.constants.ts](lib/constants/import-export.constants.ts)

| Constant Group | Purpose |
|----------------|---------|
| `REQUIRED_COLUMNS` | Excel validation |
| `OPTIONAL_COLUMNS` | Excel validation |
| `FILE_TYPES` | Allowed extensions |
| `EXCEL.*` | Date serial conversion |
| `ERRORS.*` | Error message templates |
| `RPC.*` | RPC configuration |

### 6.2 Zod Schema

**File**: [lib/data/db-row-schemas.ts:312-316](lib/data/db-row-schemas.ts#L312-L316)

```typescript
export const ImportResultRpcSchema = z.object({
  success: z.number().int().min(0),
  failed: z.number().int().min(0),
  errors: z.array(z.string()),
});
```

### 6.3 Validator

**File**: [lib/data/validate.ts](lib/data/validate.ts)

| Function | Purpose |
|----------|---------|
| `validateOrThrow<T>` | Zod validation with custom error |
| `validateArrayOrThrow<T>` | Array validation with index tracking |
| `SchemaValidationError` | Custom error class |

---

## 7. Migration History

### 7.1 import_transactions RPC Evolution

| Migration | Date | Change |
|-----------|------|--------|
| 20251215200246 | 2025-12-15 | Initial creation (NUMERIC) |
| 20251227140411 | 2025-12-27 | Fix account lookup |
| 20251227230003 | 2025-12-27 | Remove currency normalization |
| 20260101005843 | 2026-01-01 | Fix parent category trap |
| 20260104200000 | 2026-01-04 | Add 5-minute timeout |
| **20260130000000** | **2026-01-30** | **BIGINT hardening** |

### 7.2 Current RPC State

The `import_transactions` RPC is now hardened with:
- BIGINT `amount_cents` column (not NUMERIC)
- BIGINT `amount_home_cents` column (not NUMERIC)
- Proper decimal-to-cents conversion: `ROUND(v_amount * 100)::BIGINT`
- 5-minute timeout for large imports
- Hierarchy-aware category handling
- i18n support for labels

---

## 8. Findings Summary

### Violations

| ID | Category | Severity | File:Line | Description |
|----|----------|----------|-----------|-------------|
| V-001 | Feature Bleed | MEDIUM | data-export-service.ts:4 | Imports from `@/features/transactions/repository` |

### Compliant Areas

| Category | Status | Evidence |
|----------|--------|----------|
| Naming conventions | PASS | PascalCase classes, camelCase methods, snake_case RPC |
| Type safety | PASS | No `any`, Zod validation at boundary |
| Integer cents | PASS | RPC hardened 2026-01-30 |
| Sync integrity | PASS | Trigger-based versioning |
| Soft deletes | PASS | No physical DELETE ops |
| Auth abstraction | PASS | IAuthProvider interface |
| Constants externalization | PASS | All strings in constants |
| Error handling | PASS | Graceful degradation |

---

## 9. Compliance Matrix

| Mandate | Status | Evidence |
|---------|--------|----------|
| camelCase for domain objects | PASS | `processedRows`, `importFromExcel` |
| snake_case for DB rows | PASS | `p_user_id`, `p_transactions` |
| Zod Boundary Validation | PASS | `validateOrThrow(ImportResultRpcSchema, ...)` |
| Integer Cents | PASS | `ROUND(v_amount * 100)::BIGINT` in RPC |
| No Feature Bleed | **FAIL** | Import from features/transactions |
| Sync Integrity | PASS | `set_transaction_version_trigger` |
| Soft Deletes | PASS | No DELETE operations |
| Auth Abstraction | PASS | `IAuthProvider.getCurrentUserId()` |
| No `any` types | PASS | Zero occurrences |

---

## 10. Recommended Actions

### Priority 1 (MEDIUM)

**V-001: Feature Bleed**

Inject repository via constructor instead of importing factory:

```diff
// data-export-service.ts
- import { createTransactionRepository } from '@/features/transactions/repository';
+ import type { ITransactionRepository } from '@/features/transactions/repository';

export class DataExportService {
    constructor(
        private readonly supabase: SupabaseClient,
        private readonly authProvider: IAuthProvider,
+       private readonly transactionRepository: ITransactionRepository
    ) {}

    async exportToExcel() {
        const userId = await this.authProvider.getCurrentUserId();
-       const repository = createTransactionRepository(this.supabase);
-       const result = await repository.getAllPaginated(userId, {}, { offset: 0, limit: 10000 });
+       const result = await this.transactionRepository.getAllPaginated(userId, {}, { offset: 0, limit: 10000 });
```

---

## 11. File References

### Feature Files

| File | Lines | Purpose |
|------|-------|---------|
| [data-export-service.ts](features/import-export/services/data-export-service.ts) | 56 | DB → Excel export |
| [data-import-service.ts](features/import-export/services/data-import-service.ts) | 116 | Excel → DB import |

### Supporting Files

| File | Purpose |
|------|---------|
| [lib/constants/import-export.constants.ts](lib/constants/import-export.constants.ts) | Configuration constants |
| [lib/data/db-row-schemas.ts](lib/data/db-row-schemas.ts) | `ImportResultRpcSchema` |
| [lib/data/validate.ts](lib/data/validate.ts) | `validateOrThrow` helper |
| [lib/auth/auth-provider.interface.ts](lib/auth/auth-provider.interface.ts) | `IAuthProvider` interface |

### Migration Files

| File | Purpose |
|------|---------|
| [20260130000000_fix_import_transactions_bigint.sql](supabase/migrations/20260130000000_fix_import_transactions_bigint.sql) | BIGINT hardening |
| [20260112000001_repository_pattern_prep.sql](supabase/migrations/20260112000001_repository_pattern_prep.sql) | Version trigger |

---

*Generated by Technical Audit System - Revision 3*
*Previous audits: 2026-01-28 (Rev 1), 2026-01-30 (Rev 2)*
