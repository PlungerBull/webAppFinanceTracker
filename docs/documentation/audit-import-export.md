# Technical Audit Manifest: features/import-export

**Audit Date:** 2026-01-30
**Auditor Role:** Senior Systems Architect & Security Auditor
**Folder:** `features/import-export`
**Revision:** 2 (Updated after code alignment)

---

## Executive Summary

| Category | Status | Severity | Notes |
|----------|--------|----------|-------|
| Variable & Entity Registry | PASS | - | Proper typing, Zod validation added |
| Dependency Manifest | **VIOLATION** | MEDIUM | Feature bleed from transactions |
| Integer Cents | **CRITICAL** | P0 | RPC uses deleted columns (BROKEN) |
| Sync Integrity | PASS | - | Trigger-based version handling |
| Soft Deletes | PASS | - | No physical DELETE operations |
| Auth Abstraction | PASS | - | IAuthProvider used correctly |
| Performance | N/A | - | Not React components |

### Critical Finding

**The `import_transactions` RPC is BROKEN** - It references columns (`amount_original`, `amount_home`) that were dropped in migration `20260119000000_ledger_bigint_standardization.sql`. Import functionality will fail at runtime.

---

## 1. Variable & Entity Registry

### 1.1 Folder Structure

```
features/import-export/
└── services/
    ├── data-export-service.ts    (57 lines)
    └── data-import-service.ts    (117 lines)
```

### 1.2 Entity Inventory

| Entity | Type | Location | Lines | Exported |
|--------|------|----------|-------|----------|
| `ImportResult` | Interface | data-import-service.ts | 8-13 | Yes |
| `ImportRow` | Interface | data-import-service.ts | 15-24 | No (internal) |
| `DataExportService` | Class | data-export-service.ts | 12-56 | Yes |
| `DataImportService` | Class | data-import-service.ts | 26-116 | Yes |

### 1.3 Naming Audit

**Status:** COMPLIANT

| Convention | Context | Evidence |
|------------|---------|----------|
| camelCase | Domain objects | `amountCents`, `categoryName`, `accountName` |
| snake_case | RPC parameters | `p_user_id`, `p_transactions`, `p_default_account_color` |
| PascalCase | Classes/Interfaces | `DataImportService`, `ImportResult`, `ImportRow` |

### 1.4 Type Safety

**Status:** COMPLIANT (Improved from previous audit)

**V-002 RESOLVED:** RPC result now uses Zod validation:

```typescript
// data-import-service.ts:5-6 (NEW)
import { validateOrThrow } from '@/lib/data/validate';
import { ImportResultRpcSchema } from '@/lib/data/db-row-schemas';

// data-import-service.ts:104 (FIXED)
const rpcResult = validateOrThrow(ImportResultRpcSchema, data, 'ImportResultRpc');
```

**Schema Definition** ([db-row-schemas.ts:301-305](lib/data/db-row-schemas.ts#L301-L305)):

```typescript
export const ImportResultRpcSchema = z.object({
  success: z.number().int().min(0),
  failed: z.number().int().min(0),
  errors: z.array(z.string()),
});
```

**No `any` or `unknown` usage found.**

---

## 2. Dependency Manifest (Import Audit)

### 2.1 Import Inventory

**data-import-service.ts:**

| Import | Source | Category |
|--------|--------|----------|
| `read, utils` | `xlsx` | External package |
| `SupabaseClient` (type) | `@supabase/supabase-js` | External type |
| `IAuthProvider` (type) | `@/lib/auth/auth-provider.interface` | lib/ (COMPLIANT) |
| `ACCOUNT, CATEGORY, IMPORT_EXPORT` | `@/lib/constants` | lib/ (COMPLIANT) |
| `validateOrThrow` | `@/lib/data/validate` | lib/ (COMPLIANT) |
| `ImportResultRpcSchema` | `@/lib/data/db-row-schemas` | lib/ (COMPLIANT) |

**data-export-service.ts:**

| Import | Source | Category |
|--------|--------|----------|
| `utils, writeFile` | `xlsx` | External package |
| `SupabaseClient` (type) | `@supabase/supabase-js` | External type |
| `IAuthProvider` (type) | `@/lib/auth/auth-provider.interface` | lib/ (COMPLIANT) |
| `createTransactionRepository` | `@/features/transactions/repository` | **VIOLATION** |

### 2.2 Feature Bleed Check

**Status:** VIOLATION (V-001 - Still Present)

| File | Line | Import | Severity |
|------|------|--------|----------|
| data-export-service.ts | 4 | `@/features/transactions/repository` | MEDIUM |

```typescript
// data-export-service.ts:4 - VIOLATION
import { createTransactionRepository } from '@/features/transactions/repository';
```

**Rule Violated:** Features should only import from `lib/`, `components/shared`, or their own subfolders.

**Recommended Fix Options:**

1. **Option A (Preferred):** Move `ITransactionRepository` interface to `lib/repositories/` and have data-export-service depend on the interface only
2. **Option B:** Inject repository via constructor instead of importing factory
3. **Option C:** Create `lib/data/transaction-data-access.ts` abstraction

### 2.3 Transformer Check

**Status:** INLINE MAPPING (Acceptable)

Both services use inline mapping logic instead of `@/lib/types/data-transformers`:

| File | Lines | Description |
|------|-------|-------------|
| data-export-service.ts | 33-42 | Domain → Excel row mapping |
| data-import-service.ts | 59-87 | Excel date preprocessing |

**Justification:** Excel column format differs from domain transformers. Inline mapping is appropriate for I/O boundary adaptation.

### 2.4 External Dependencies

| Package | Version | Usage | Security |
|---------|---------|-------|----------|
| `xlsx` | - | Excel read/write | Review for CVEs |
| `@supabase/supabase-js` | - | Type import only | Safe |

---

## 3. Sacred Mandate Compliance

### 3.1 Integer Cents

**Status:** CRITICAL VIOLATION (P0)

#### The Problem

The `import_transactions` RPC ([20260104200000_fix_import_timeout.sql:187-209](supabase/migrations/20260104200000_fix_import_timeout.sql#L187-L209)) references columns that **no longer exist**:

```sql
-- CURRENT RPC CODE (BROKEN)
INSERT INTO transactions (
  user_id, date,
  amount_original,    -- ❌ DELETED in 20260119000000
  amount_home,        -- ❌ DELETED in 20260119000000
  exchange_rate, description, notes,
  account_id, category_id, source_text
) VALUES (...)
```

#### Migration Timeline Analysis

| Migration | Action | Result |
|-----------|--------|--------|
| 20260104200000 | Creates `import_transactions` RPC | Uses `amount_original`, `amount_home` |
| **20260119000000** | Drops `amount_original`, `amount_home` | **Breaks import_transactions** |
| 20260119000002 | Hardens `promote_inbox_item`, `create_transfer`, `update_transaction` | **Does NOT fix import_transactions** |

#### Evidence

From [20260119000000_ledger_bigint_standardization.sql:38-40](supabase/migrations/20260119000000_ledger_bigint_standardization.sql#L38-L40):

```sql
-- Step 3: Drop legacy NUMERIC columns
ALTER TABLE transactions
DROP COLUMN amount_original,
DROP COLUMN amount_home;
```

But `import_transactions` was **never updated** to use `amount_cents` and `amount_home_cents`.

#### Impact

- **Import functionality is completely broken**
- Any attempt to use `DataImportService.importFromExcel()` will fail with:
  ```
  ERROR: column "amount_original" does not exist
  ```

#### Required Fix

Create new migration to update `import_transactions` RPC:

```sql
-- REQUIRED FIX: Update import_transactions to BIGINT
CREATE OR REPLACE FUNCTION public.import_transactions(...)
AS $$
  ...
  INSERT INTO transactions (
    user_id, date,
    amount_cents,           -- FIXED: BIGINT (was amount_original)
    amount_home_cents,      -- FIXED: BIGINT (was amount_home)
    exchange_rate, description, notes,
    account_id, category_id, source_text
  ) VALUES (
    p_user_id, v_date,
    ROUND(v_amount * 100)::BIGINT,     -- Convert decimal to cents
    ROUND(v_amount * v_exchange_rate * 100)::BIGINT,
    ...
  );
  ...
$$;
```

### 3.2 Sync Integrity

**Status:** COMPLIANT

The `set_transaction_version_trigger` ([20260112000001_repository_pattern_prep.sql:44-59](supabase/migrations/20260112000001_repository_pattern_prep.sql#L44-L59)) handles version bumping automatically:

```sql
CREATE TRIGGER set_transaction_version_trigger
BEFORE INSERT OR UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION set_transaction_version();

-- Function assigns:
NEW.version := nextval('global_transaction_version');
NEW.updated_at := NOW();
```

**All INSERT/UPDATE operations automatically get version tracking.**

### 3.3 Soft Deletes

**Status:** COMPLIANT

| File | Operation Type | DELETE Statements |
|------|---------------|-------------------|
| data-export-service.ts | Read-only | None |
| data-import-service.ts | Insert-only | None |
| import_transactions RPC | Insert-only | None |

Tombstone pattern (`deleted_at` column) exists in schema and is properly filtered in views.

### 3.4 Auth Abstraction

**Status:** COMPLIANT

| File | Lines | Pattern |
|------|-------|---------|
| data-export-service.ts | 3, 15, 19 | `IAuthProvider.getCurrentUserId()` |
| data-import-service.ts | 3, 29, 89 | `IAuthProvider.getCurrentUserId()` |

**No direct `supabase.auth.getUser()` calls found.**

Both services receive `IAuthProvider` via constructor injection:

```typescript
// data-import-service.ts:26-30
export class DataImportService {
    constructor(
        private readonly supabase: SupabaseClient,
        private readonly authProvider: IAuthProvider  // ✓ Interface injection
    ) {}
```

---

## 4. Performance & Scalability

### 4.1 React Compiler Check

**Status:** N/A

These are TypeScript service classes, not React components:

- No `watch()` calls
- No `useWatch()` calls
- No `useEffect()` or `useMemo()` calls
- No hooks of any kind

### 4.2 Re-render Optimization

**Status:** N/A

No React rendering lifecycle in service classes.

### 4.3 RPC Performance

**import_transactions RPC Observations:**

| Aspect | Status | Notes |
|--------|--------|-------|
| Statement timeout | 5 minutes | `SET statement_timeout TO '300000'` |
| Batch processing | Row-by-row loop | Could benefit from bulk INSERT |
| Error handling | Per-row try/catch | Allows partial imports |
| Concurrency | ON CONFLICT upserts | Handles race conditions |

**Potential Optimization:** Consider converting row-by-row INSERTs to bulk INSERT with `unnest()` for large imports (3000+ transactions).

---

## 5. Critical Findings Summary

### P0 - Critical (Blocking)

| ID | Category | File | Description |
|----|----------|------|-------------|
| **V-003** | Integer Cents | import_transactions RPC | RPC references deleted columns `amount_original`, `amount_home`. **Import is BROKEN.** |

### P1 - High (Feature Bleed)

| ID | Category | File:Line | Description |
|----|----------|-----------|-------------|
| V-001 | Dependency | data-export-service.ts:4 | Imports from `@/features/transactions/repository` |

### Resolved Issues

| ID | Previous Status | Resolution |
|----|-----------------|------------|
| V-002 | Type assertion on RPC result | Now uses `validateOrThrow(ImportResultRpcSchema, ...)` |

---

## 6. Recommended Remediations

### Priority 0 (CRITICAL - Fix Immediately)

**V-003: Broken import_transactions RPC**

Create migration `20260130000000_fix_import_transactions_bigint.sql`:

```sql
CREATE OR REPLACE FUNCTION public.import_transactions(
  p_user_id uuid,
  p_transactions jsonb,
  p_default_account_color text,
  p_default_category_color text,
  p_general_label text DEFAULT 'General',
  p_uncategorized_label text DEFAULT 'Uncategorized'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '300000'
AS $$
DECLARE
  -- ... existing declarations ...
  v_amount_cents BIGINT;  -- NEW: Store as integer cents
BEGIN
  FOR v_transaction IN SELECT * FROM jsonb_array_elements(p_transactions)
  LOOP
    BEGIN
      -- Extract and convert to cents
      v_amount_cents := ROUND((v_transaction->>'Amount')::numeric * 100)::BIGINT;

      -- ... existing account/category logic ...

      INSERT INTO transactions (
        user_id, date,
        amount_cents,        -- FIXED: BIGINT
        amount_home_cents,   -- FIXED: BIGINT
        exchange_rate, description, notes,
        account_id, category_id, source_text
      ) VALUES (
        p_user_id, v_date,
        v_amount_cents,
        ROUND(v_amount_cents * v_exchange_rate)::BIGINT,
        v_exchange_rate, v_description, v_notes,
        v_account_id, v_category_id, v_category_name
      );
      -- ...
    END;
  END LOOP;
  -- ...
END;
$$;
```

### Priority 1 (HIGH)

**V-001: Feature Bleed**

Option A - Move interface to lib/:

```diff
// data-export-service.ts
- import { createTransactionRepository } from '@/features/transactions/repository';
+ import type { ITransactionRepository } from '@/lib/repositories/transaction-repository.interface';

export class DataExportService {
    constructor(
        private readonly supabase: SupabaseClient,
        private readonly authProvider: IAuthProvider,
+       private readonly transactionRepository: ITransactionRepository  // Inject via constructor
    ) {}
```

---

## 7. File References

### Service Files

- [data-export-service.ts](features/import-export/services/data-export-service.ts)
- [data-import-service.ts](features/import-export/services/data-import-service.ts)

### Supporting Files

- [db-row-schemas.ts](lib/data/db-row-schemas.ts) - `ImportResultRpcSchema`
- [validate.ts](lib/data/validate.ts) - `validateOrThrow`
- [import-export.constants.ts](lib/constants/import-export.constants.ts) - Constants

### Migration Files (Relevant)

- [20260104200000_fix_import_timeout.sql](supabase/migrations/20260104200000_fix_import_timeout.sql) - **BROKEN RPC**
- [20260119000000_ledger_bigint_standardization.sql](supabase/migrations/20260119000000_ledger_bigint_standardization.sql) - Dropped columns
- [20260119000002_harden_all_ledger_rpcs.sql](supabase/migrations/20260119000002_harden_all_ledger_rpcs.sql) - Hardened other RPCs (not import)
- [20260112000001_repository_pattern_prep.sql](supabase/migrations/20260112000001_repository_pattern_prep.sql) - Version trigger

---

## 8. Compliance Matrix

| Mandate | Status | Evidence |
|---------|--------|----------|
| camelCase for domain objects | PASS | All domain objects use camelCase |
| snake_case for DB rows | PASS | RPC params use snake_case |
| Zod Boundary Validation | PASS | `ImportResultRpcSchema` with `validateOrThrow` |
| Integer Cents | **FAIL** | RPC uses deleted NUMERIC columns |
| No Feature Bleed | **FAIL** | Imports from features/transactions |
| Sync Integrity | PASS | Trigger-based version handling |
| Soft Deletes | PASS | No physical DELETE operations |
| Auth Abstraction | PASS | `IAuthProvider` used consistently |
| No `any` types | PASS | No `any` or `unknown` in import-export |

---

*Generated by Technical Audit System - Revision 2*
*Previous audit: 2026-01-28 | Current audit: 2026-01-30*
