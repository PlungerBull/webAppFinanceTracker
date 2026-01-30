# Technical Audit Manifest: features/currencies

> **Audit Date:** 2026-01-30
> **Auditor Role:** Senior Systems Architect & Security Auditor
> **Scope:** Composable Manifest for `features/currencies`
> **Revision:** 2.0 (Updated after codebase alignment)

---

## Executive Summary

| Metric | Result |
|--------|--------|
| **Total Files** | 2 |
| **Feature Bleed Violations** | 1 VIOLATION FOUND |
| **Type Safety Violations** | 0 |
| **Zod Boundary Validation** | MISSING |
| **Sacred Mandate Compliance** | N/A (read-only) |
| **Performance Issues** | 0 |
| **Overall Status** | NEEDS ATTENTION |

---

## Folder Structure

```
features/currencies/
├── api/
│   └── currencies.ts          # 26 lines - API layer for currency operations
└── hooks/
    └── use-currencies.ts      # 15 lines - React Query hook for fetching currencies
```

**Total: 2 files, ~41 lines of code**

---

## 1. Variable & Entity Registry

### 1.1 Entity Inventory

#### Domain Entity: `Currency`
**Location:** [types/domain.ts:170-175](types/domain.ts#L170-L175)

```typescript
export interface Currency {
  code: string;           // ISO 4217 code (e.g., "USD", "EUR", "PEN")
  name: string;           // Display name (e.g., "United States Dollar")
  symbol: string;         // Currency symbol (e.g., "$", "€")
  flag: string | null;    // Unicode flag emoji (nullable)
}
```

**Field Analysis:**

| Field | Type | Nullable | Purpose |
|-------|------|----------|---------|
| `code` | `string` | No | ISO 4217 currency code (primary key) |
| `name` | `string` | No | Human-readable display name |
| `symbol` | `string` | No | Currency symbol for formatting |
| `flag` | `string \| null` | Yes | Unicode flag emoji for UI decoration |

#### Database Schema: `global_currencies`
**Location:** [types/database.types.ts:147-167](types/database.types.ts#L147-L167)

```typescript
global_currencies: {
  Row: {
    code: string;
    flag: string | null;
    name: string;
    symbol: string;
  }
  Insert: {
    code: string;
    flag?: string | null;
    name: string;
    symbol: string;
  }
  Update: {
    code?: string;
    flag?: string | null;
    name?: string;
    symbol?: string;
  }
  Relationships: []  // No foreign keys to other tables
}
```

**Foreign Key References (Inbound):**
- `bank_accounts.currency_code` → `global_currencies.code`
- `user_settings.main_currency` → `global_currencies.code`

#### DTOs Defined: **NONE**

The currencies feature is read-only with no insert/update operations exposed via the API, so no DTOs are required.

### 1.2 Naming Audit

| Layer | Convention | Example | Status |
|-------|------------|---------|--------|
| Domain Objects | camelCase | `Currency.flag` | COMPLIANT |
| Database Rows | snake_case | `global_currencies.flag` | COMPLIANT |
| Transformer Output | camelCase | `dbCurrencyToDomain()` returns `{ flag: ... }` | COMPLIANT |

**Note:** Currency fields are identical in both layers (code, name, symbol, flag) since they are single-word properties. The data transformer still provides the architectural separation boundary.

### 1.3 Type Safety Audit

#### Currencies Feature Code

| File | `any` Count | `unknown` Count | Naked Types |
|------|-------------|-----------------|-------------|
| `api/currencies.ts` | 0 | 0 | 0 |
| `hooks/use-currencies.ts` | 0 | 0 | 0 |

**Status: EXCELLENT** - Zero type safety violations in currencies feature code.

#### Data Transformer Analysis
**Location:** [lib/data/data-transformers.ts:135-144](lib/data/data-transformers.ts#L135-L144)

```typescript
export function dbCurrencyToDomain(
  dbCurrency: Database['public']['Tables']['global_currencies']['Row']
) {
  return {
    code: dbCurrency.code,
    name: dbCurrency.name,
    symbol: dbCurrency.symbol,
    flag: dbCurrency.flag,
  } as const;
}
```

| Check | Status | Notes |
|-------|--------|-------|
| Type parameter | Strongly typed | Uses `Database['public']['Tables']['global_currencies']['Row']` |
| Return type | Inferred with `as const` | Provides readonly type narrowing |
| Null handling | Correct | `flag` passes through as `string \| null` |

#### Batch Transformer
**Location:** [lib/data/data-transformers.ts:666-670](lib/data/data-transformers.ts#L666-L670)

```typescript
export function dbCurrenciesToDomain(
  dbCurrencies: Database['public']['Tables']['global_currencies']['Row'][]
) {
  return dbCurrencies.map(dbCurrencyToDomain);
}
```

### 1.4 Zod Boundary Validation

**STATUS: MISSING**

**Location checked:** [lib/data/db-row-schemas.ts](lib/data/db-row-schemas.ts)

There is **NO** `GlobalCurrencyRowSchema` defined in db-row-schemas.ts. The currencies feature bypasses Zod validation at the network boundary.

**Impact Assessment:**
- Risk: Low (read-only reference data, schema controlled by DB)
- Recommendation: Add schema for consistency with other entities

**Recommended Schema:**
```typescript
export const GlobalCurrencyRowSchema = z.object({
  code: z.string().length(3),  // ISO 4217
  name: z.string(),
  symbol: z.string(),
  flag: z.string().nullable(),
});
```

---

## 2. Dependency Manifest (Import Audit)

### 2.1 Feature Bleed Check

#### `features/currencies/api/currencies.ts`

```typescript
import { createClient } from '@/lib/supabase/client';      // LIB - ALLOWED
import { CURRENCY } from '@/lib/constants';                 // LIB - ALLOWED
import { dbCurrenciesToDomain } from '@/lib/data/data-transformers'; // LIB - ALLOWED
```

**Status: NO VIOLATIONS** - All imports from `@/lib/`

#### `features/currencies/hooks/use-currencies.ts`

```typescript
import { useQuery } from '@tanstack/react-query';           // EXTERNAL - ALLOWED
import { currenciesApi } from '../api/currencies';          // SAME FEATURE - ALLOWED
import { QUERY_CONFIG, QUERY_KEYS } from '@/lib/constants'; // LIB - ALLOWED
```

**Status: NO VIOLATIONS** - All imports compliant

### 2.2 Incoming Dependencies (Who Imports Currencies?)

| File | Import Statement | Status |
|------|------------------|--------|
| [features/accounts/components/add-account-modal.tsx:7](features/accounts/components/add-account-modal.tsx#L7) | `import { useCurrencies } from '@/features/currencies/hooks/use-currencies';` | **VIOLATION** |
| [lib/hooks/use-currency-manager.ts:2](lib/hooks/use-currency-manager.ts#L2) | `import { useCurrencies } from '@/features/currencies/hooks/use-currencies';` | ALLOWED (lib/) |
| [lib/hooks/use-reference-data.ts:27](lib/hooks/use-reference-data.ts#L27) | `import { currenciesApi } from '@/features/currencies/api/currencies';` | ALLOWED (lib/) |

#### Feature Bleed Violation Detail

**File:** `features/accounts/components/add-account-modal.tsx`
**Line:** 7
**Import:** `import { useCurrencies } from '@/features/currencies/hooks/use-currencies';`

**ESLint Rule Exists:** Yes - [eslint.config.mjs:51-54](eslint.config.mjs#L51-L54)
```javascript
{
  group: ["@/features/currencies/hooks/*", "@/features/currencies/domain/*", "@/features/currencies/services/*"],
  message: "Import from @/lib/hooks/use-reference-data instead of directly from features/currencies."
}
```

**Fix Required:** Replace with:
```typescript
import { useCurrenciesData } from '@/lib/hooks/use-reference-data';
// Then use: const { currencies, isLoading } = useCurrenciesData();
```

### 2.3 Transformer Check

| Check | Status | Implementation |
|-------|--------|----------------|
| Uses data-transformers.ts | YES | `dbCurrenciesToDomain()` at line 3 of `currencies.ts` |
| Inline mapping logic | NONE | All transformation delegated to lib |
| Transformer location | Correct | [lib/data/data-transformers.ts:666-670](lib/data/data-transformers.ts#L666-L670) |

---

## 3. The "Sacred Mandate" Compliance

### 3.1 Integer Cents

| Status | Rationale |
|--------|-----------|
| **N/A** | Currencies feature is read-only reference data. No financial calculations performed. No amount fields in `global_currencies` table. |

### 3.2 Sync Integrity (Delta Sync Engine)

| Status | Rationale |
|--------|-----------|
| **N/A** | Global reference data does not participate in user-level sync. No `version` or `deleted_at` columns in `global_currencies` table. |

**Database Schema Verification:**
- `global_currencies` has no `version` column
- `global_currencies` has no `deleted_at` column
- This is correct: currencies are system-maintained, not user-modifiable

### 3.3 Soft Deletes (Tombstone Pattern)

| Status | Rationale |
|--------|-----------|
| **N/A** | No delete operations exist. Feature is read-only. |

**API Operations Audit:**

```typescript
// currencies.ts - ONLY operation
export const currenciesApi = {
  getAll: async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('global_currencies')
      .select('*')
      .order('code', { ascending: true });
    // ...
  },
};
```

| Operation | Exists | Has Soft Delete |
|-----------|--------|-----------------|
| `getAll()` | YES | N/A (read-only) |
| `create()` | NO | N/A |
| `update()` | NO | N/A |
| `delete()` | NO | N/A |

### 3.4 Auth Abstraction (IAuthProvider)

| Status | Rationale |
|--------|-----------|
| **APPROPRIATE** | Direct Supabase client is correct for public reference data. |

**Analysis:**
- Currencies are **global reference data**, not user-specific
- No RLS (Row Level Security) needed - all users see same currencies
- `IAuthProvider` is reserved for user-context operations
- Direct `createClient()` usage is the correct pattern here

**Code Reference:**
```typescript
// currencies.ts:10-15
const supabase = createClient();
const { data, error } = await supabase
  .from('global_currencies')
  .select('*')
  .order('code', { ascending: true });
```

---

## 4. Performance & Scalability

### 4.1 React Compiler Check

| Pattern | File | Status | Details |
|---------|------|--------|---------|
| `watch()` | `use-currencies.ts` | N/A | No react-hook-form usage |
| `useWatch()` | `use-currencies.ts` | N/A | No react-hook-form usage |

**Note:** The currencies hook uses React Query, not react-hook-form. No form-related patterns to audit.

### 4.2 Re-render Optimization

| Check | Status | Details |
|-------|--------|---------|
| Raw `useEffect` for data fetching | NONE | Uses React Query `useQuery` |
| Unbounded `useMemo` | NONE | No memoization in feature |
| Missing dependency arrays | N/A | No hooks with deps |
| Heavy computations in render | NONE | Simple pass-through |

### 4.3 Caching Strategy

**Location:** [features/currencies/hooks/use-currencies.ts:8-13](features/currencies/hooks/use-currencies.ts#L8-L13)

```typescript
export function useCurrencies() {
  return useQuery({
    queryKey: QUERY_KEYS.CURRENCIES,
    queryFn: currenciesApi.getAll,
    staleTime: QUERY_CONFIG.STALE_TIME.LONG, // 10 minutes
  });
}
```

| Setting | Value | Source | Assessment |
|---------|-------|--------|------------|
| `queryKey` | `['currencies']` | `QUERY_KEYS.CURRENCIES` | Centralized, correct |
| `staleTime` | 600,000ms (10 min) | `QUERY_CONFIG.STALE_TIME.LONG` | OPTIMAL for reference data |
| `gcTime` | Default (5 min) | React Query default | Acceptable |

### 4.4 Query Constants Audit

**Location:** [lib/constants/query.constants.ts:50](lib/constants/query.constants.ts#L50)

```typescript
CURRENCIES: ['currencies'] as const,
```

**Status: COMPLIANT** - Query key is centralized in constants.

---

## 5. Architecture Assessment

### 5.1 Dependency Graph

```
                    ┌─────────────────────────────────┐
                    │      global_currencies (DB)     │
                    │   (ISO 4217 reference data)     │
                    └───────────────┬─────────────────┘
                                    │
                    ┌───────────────▼─────────────────┐
                    │   features/currencies/api/      │
                    │       currencies.ts             │
                    │   (Supabase query + transform)  │
                    └───────────────┬─────────────────┘
                                    │
                    ┌───────────────▼─────────────────┐
                    │   features/currencies/hooks/    │
                    │      use-currencies.ts          │
                    │   (React Query wrapper)         │
                    └───────────────┬─────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────────┐   ┌───────────────────────┐   ┌───────────────────┐
│ lib/hooks/        │   │ lib/hooks/            │   │ features/accounts │
│ use-reference-    │   │ use-currency-         │   │ add-account-      │
│ data.ts           │   │ manager.ts            │   │ modal.tsx         │
│ (ALLOWED)         │   │ (ALLOWED)             │   │ (VIOLATION!)      │
└───────────────────┘   └───────────────────────┘   └───────────────────┘
        │                           │
        ▼                           ▼
┌───────────────────────────────────────────────────────────────────────┐
│                         UI Components                                 │
│   (currency-settings.tsx, add-account-modal.tsx, transfer-form.tsx)  │
└───────────────────────────────────────────────────────────────────────┘
```

### 5.2 Strengths

1. **Minimal Surface Area** - Only 2 files, ~41 lines total
2. **Read-Only Design** - Appropriate for global reference data
3. **Proper Data Transformation** - Uses centralized `dbCurrenciesToDomain()`
4. **React Query Integration** - No raw `useEffect` for data fetching
5. **Centralized Query Keys** - Uses `QUERY_KEYS.CURRENCIES`
6. **Optimal Caching** - 10-minute stale time for rarely-changing data
7. **Type Safety** - Zero `any`/`unknown` in feature code
8. **ESLint Protection** - Rule exists to prevent feature bleed

### 5.3 Weaknesses

1. **Missing Zod Schema** - No `GlobalCurrencyRowSchema` in db-row-schemas.ts
2. **Feature Bleed Violation** - `add-account-modal.tsx` imports directly
3. **No Index Exports** - No `features/currencies/index.ts` barrel file

---

## 6. Findings Summary

### 6.1 Critical Issues

| ID | Severity | File | Issue | Fix |
|----|----------|------|-------|-----|
| CUR-001 | **HIGH** | [features/accounts/components/add-account-modal.tsx:7](features/accounts/components/add-account-modal.tsx#L7) | Feature bleed: Direct import from currencies feature | Use `useCurrenciesData` from `@/lib/hooks/use-reference-data` |

### 6.2 Recommended Improvements

| ID | Priority | Issue | Recommendation |
|----|----------|-------|----------------|
| CUR-002 | Medium | Missing Zod schema | Add `GlobalCurrencyRowSchema` to `lib/data/db-row-schemas.ts` |
| CUR-003 | Low | No barrel file | Consider adding `features/currencies/index.ts` for cleaner exports |

---

## 7. Code Samples

### 7.1 Complete API Layer

**File:** [features/currencies/api/currencies.ts](features/currencies/api/currencies.ts)

```typescript
import { createClient } from '@/lib/supabase/client';
import { CURRENCY } from '@/lib/constants';
import { dbCurrenciesToDomain } from '@/lib/data/data-transformers';

export const currenciesApi = {
  /**
   * Get all global currencies (read-only, no user filtering needed)
   */
  getAll: async () => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('global_currencies')
      .select('*')
      .order('code', { ascending: true });

    if (error) {
      console.error(CURRENCY.API.CONSOLE.FETCH_CURRENCIES, error);
      throw new Error(error.message || CURRENCY.API.ERRORS.FETCH_ALL_FAILED);
    }

    // Transform snake_case to camelCase before returning to frontend
    return data ? dbCurrenciesToDomain(data) : [];
  },
};
```

### 7.2 Complete Hook Layer

**File:** [features/currencies/hooks/use-currencies.ts](features/currencies/hooks/use-currencies.ts)

```typescript
import { useQuery } from '@tanstack/react-query';
import { currenciesApi } from '../api/currencies';
import { QUERY_CONFIG, QUERY_KEYS } from '@/lib/constants';

/**
 * Hook to fetch all global currencies (read-only)
 */
export function useCurrencies() {
  return useQuery({
    queryKey: QUERY_KEYS.CURRENCIES,
    queryFn: currenciesApi.getAll,
    staleTime: QUERY_CONFIG.STALE_TIME.LONG, // Currencies rarely change
  });
}
```

---

## 8. Compliance Matrix

| Mandate | Status | Evidence |
|---------|--------|----------|
| Naming (camelCase domain / snake_case DB) | PASS | `Currency` vs `global_currencies` |
| Type Safety (no any/unknown) | PASS | Zero violations in feature code |
| Zod Boundary Validation | **FAIL** | No schema in db-row-schemas.ts |
| Feature Isolation | **FAIL** | 1 violation in add-account-modal.tsx |
| Transformer Usage | PASS | Uses `dbCurrenciesToDomain()` |
| Integer Cents | N/A | No financial calculations |
| Sync Integrity | N/A | Read-only reference data |
| Soft Deletes | N/A | No delete operations |
| Auth Abstraction | PASS | Direct client appropriate for public data |
| React Query Patterns | PASS | Proper useQuery, centralized keys |
| Caching Strategy | PASS | 10-minute stale time |

---

## 9. Action Items

### Immediate (P0)

- [ ] **CUR-001**: Fix feature bleed in `add-account-modal.tsx`
  - Replace `import { useCurrencies } from '@/features/currencies/hooks/use-currencies'`
  - With `import { useCurrenciesData } from '@/lib/hooks/use-reference-data'`

### Short-term (P1)

- [ ] **CUR-002**: Add Zod schema for currencies
  - Add `GlobalCurrencyRowSchema` to `lib/data/db-row-schemas.ts`
  - Integrate validation in `currenciesApi.getAll()`

### Nice-to-have (P2)

- [ ] **CUR-003**: Add barrel file `features/currencies/index.ts`

---

*Generated by Technical Audit Process v2.0*
