# Composable Manifest: features/currencies

> **Generated:** 2026-01-31
> **Revision:** 3.0 (Post-alignment comprehensive audit)
> **Auditor:** Senior Systems Architect & Security Auditor
> **Scope:** `/features/currencies/` folder + related orchestrator hooks

---

## Executive Summary

| Category | Status | Notes |
|----------|--------|-------|
| **Variable & Entity Registry** | PASS | Clean, minimal |
| **Dependency Manifest** | PASS | 0 violations |
| **Zod Boundary Validation** | PASS | HARDENED |
| **Transformer Usage** | PASS | Centralized |
| **Sacred Mandate** | N/A | Read-only reference data |
| **Performance** | PASS | Optimal caching |

**Overall Result: PASSED**

---

## 1. Variable & Entity Registry

### 1.1 Feature File Inventory

**Total Files in Feature:** 1

```
features/currencies/
└── api/
    └── currencies.ts          # 32 lines - API layer with Zod validation
```

**Note:** The `hooks/` subfolder was intentionally removed. The `useCurrencies` hook now lives in `lib/hooks/use-currencies.ts` following the Orchestrator Pattern.

### 1.2 Entity Inventory

| Name | Kind | Location | Lines |
|------|------|----------|-------|
| `Currency` | Interface | [types/domain.ts:170-175](types/domain.ts#L170-L175) | 6 |
| `GlobalCurrencyRowSchema` | Zod Schema | [lib/data/db-row-schemas.ts:256-261](lib/data/db-row-schemas.ts#L256-L261) | 6 |
| `currenciesApi` | API Object | [features/currencies/api/currencies.ts:7-31](features/currencies/api/currencies.ts#L7-L31) | 25 |

#### Domain Entity: `Currency`

```typescript
// types/domain.ts:170-175
export interface Currency {
  code: string;           // ISO 4217 code (e.g., "USD", "EUR", "PEN")
  name: string;           // Human-readable display name
  symbol: string;         // Currency symbol (e.g., "$", "€")
  flag: string | null;    // Unicode flag emoji (nullable)
}
```

| Field | Type | Nullable | Validation | Purpose |
|-------|------|----------|------------|---------|
| `code` | `string` | No | `z.string()` | ISO 4217 currency code (primary key) |
| `name` | `string` | No | `z.string()` | Human-readable display name |
| `symbol` | `string` | No | `z.string()` | Currency symbol for formatting |
| `flag` | `string \| null` | Yes | `z.string().nullable()` | Unicode flag emoji |

#### Database Schema: `global_currencies`

```typescript
// types/database.types.ts:147-167
global_currencies: {
  Row: {
    code: string;
    flag: string | null;
    name: string;
    symbol: string;
  }
  Relationships: []  // No foreign keys FROM this table
}
```

**Inbound Foreign Key References:**
| Referencing Table | Column | Constraint |
|-------------------|--------|------------|
| `bank_accounts` | `currency_code` | `bank_accounts_currency_code_fkey` |
| `user_settings` | `main_currency` | `user_settings_main_currency_fkey` |

### 1.3 Naming Convention Audit

| Layer | Convention | Example | Status |
|-------|------------|---------|--------|
| Domain Objects | camelCase | `Currency.flag` | COMPLIANT |
| Database Rows | snake_case | `global_currencies.flag` | COMPLIANT |
| Zod Schema | snake_case (DB match) | `GlobalCurrencyRowSchema.flag` | COMPLIANT |
| Transformer Output | camelCase | `{ flag: dbCurrency.flag }` | COMPLIANT |

### 1.4 Type Safety Audit

| File | `any` | `unknown` | Naked Types | Status |
|------|-------|-----------|-------------|--------|
| `features/currencies/api/currencies.ts` | 0 | 0 | 0 | PASS |
| `lib/hooks/use-currencies.ts` | 0 | 0 | 0 | PASS |
| `lib/data/db-row-schemas.ts` (GlobalCurrencyRowSchema) | 0 | 0 | 0 | PASS |
| `lib/data/data-transformers.ts` (dbCurrencyToDomain) | 0 | 0 | 0 | PASS |

**Result: ZERO type safety violations**

### 1.5 Zod Boundary Validation

**Status: PASS (HARDENED)**

**Schema Location:** [lib/data/db-row-schemas.ts:256-261](lib/data/db-row-schemas.ts#L256-L261)

```typescript
/**
 * global_currencies table Row
 *
 * Reference data for currency codes, names, symbols, and flags.
 * Used by currenciesApi for display purposes.
 */
export const GlobalCurrencyRowSchema = z.object({
  code: z.string(),             // ISO 4217 code (e.g., "USD", "EUR")
  name: z.string(),             // Human-readable name (e.g., "US Dollar")
  symbol: z.string(),           // Currency symbol (e.g., "$", "€")
  flag: z.string().nullable(),  // Emoji flag or null
});
```

**Validation Integration:** [features/currencies/api/currencies.ts:25-26](features/currencies/api/currencies.ts#L25-L26)

```typescript
// HARDENED: Zod validation at network boundary
const validated = z.array(GlobalCurrencyRowSchema).parse(data ?? []);

// Transform snake_case to camelCase before returning to frontend
return dbCurrenciesToDomain(validated);
```

**Validation Flow:**
```
Supabase Response → Zod Parse → Data Transformer → Domain Type → React Component
       ↓                ↓              ↓                ↓              ↓
   unknown[]    GlobalCurrencyRow[]  Currency[]     Currency[]      UI
```

---

## 2. Dependency Manifest

### 2.1 Feature Bleed Check

**Result: PASS** - Zero prohibited cross-feature imports.

#### `features/currencies/api/currencies.ts` Imports

| Import | Source | Type | Status |
|--------|--------|------|--------|
| `z` | `zod` | External | ALLOWED |
| `createClient` | `@/lib/supabase/client` | Library | ALLOWED |
| `CURRENCY` | `@/lib/constants` | Library | ALLOWED |
| `dbCurrenciesToDomain` | `@/lib/data/data-transformers` | Library | ALLOWED |
| `GlobalCurrencyRowSchema` | `@/lib/data/db-row-schemas` | Library | ALLOWED |

### 2.2 Orchestrator Layer (lib/hooks)

**Architecture Pattern:** Features expose APIs, lib/ provides hooks.

| Orchestrator Hook | Location | Purpose |
|-------------------|----------|---------|
| `useCurrencies` | [lib/hooks/use-currencies.ts:8-14](lib/hooks/use-currencies.ts#L8-L14) | Primary hook for currencies data |
| `useCurrenciesData` | [lib/hooks/use-reference-data.ts:139-149](lib/hooks/use-reference-data.ts#L139-L149) | Lightweight alternative |
| `useCurrencyManager` | [lib/hooks/use-currency-manager.ts:34-142](lib/hooks/use-currency-manager.ts#L34-L142) | Form state management |

**`lib/hooks/use-currencies.ts`:**
```typescript
import { useQuery } from '@tanstack/react-query';
import { currenciesApi } from '@/features/currencies/api/currencies';
import { QUERY_CONFIG, QUERY_KEYS } from '@/lib/constants';

export function useCurrencies() {
  return useQuery({
    queryKey: QUERY_KEYS.CURRENCIES,
    queryFn: currenciesApi.getAll,
    staleTime: QUERY_CONFIG.STALE_TIME.LONG,
  });
}
```

### 2.3 Consumer Analysis

**All consumers use proper orchestrator imports:**

| Consumer | Import | Source | Status |
|----------|--------|--------|--------|
| [features/accounts/components/add-account-modal.tsx:7](features/accounts/components/add-account-modal.tsx#L7) | `useCurrencies` | `@/lib/hooks/use-currencies` | COMPLIANT |
| [features/settings/components/currency-settings.tsx:3](features/settings/components/currency-settings.tsx#L3) | `useCurrenciesData` | `@/lib/hooks/use-reference-data` | COMPLIANT |
| [lib/hooks/use-currency-manager.ts:2](lib/hooks/use-currency-manager.ts#L2) | `useCurrencies` | `@/lib/hooks/use-currencies` | COMPLIANT |

### 2.4 Transformer Usage

| Check | Status | Evidence |
|-------|--------|----------|
| Uses `data-transformers.ts` | YES | [currencies.ts:4](features/currencies/api/currencies.ts#L4) |
| Inline mapping logic | NONE | All transformation delegated |
| Transformer location | Correct | [data-transformers.ts:134-144, 661-665](lib/data/data-transformers.ts#L134-L144) |

**Transformer Implementation:**
```typescript
// lib/data/data-transformers.ts:134-144
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

// lib/data/data-transformers.ts:661-665
export function dbCurrenciesToDomain(
  dbCurrencies: Database['public']['Tables']['global_currencies']['Row'][]
) {
  return dbCurrencies.map(dbCurrencyToDomain);
}
```

---

## 3. Sacred Mandate Compliance

### 3.1 Integer Cents

| Status | Rationale |
|--------|-----------|
| **N/A** | `global_currencies` contains no monetary amounts. It is reference data (code, name, symbol, flag). |

### 3.2 Sync Integrity (Delta Sync Engine)

| Status | Rationale |
|--------|-----------|
| **N/A** | Global reference data does not participate in user-level sync. No `version` or `deleted_at` columns needed. |

**Schema Verification:**
- `global_currencies` has no `version` column (correct)
- `global_currencies` has no `deleted_at` column (correct)
- Currencies are system-maintained, not user-modifiable

### 3.3 Soft Deletes (Tombstone Pattern)

| Status | Rationale |
|--------|-----------|
| **N/A** | Feature is read-only. No create/update/delete operations. |

**Operations Inventory:**

| Operation | Exists | Implementation |
|-----------|--------|----------------|
| `getAll()` | YES | Read-only query with Zod validation |
| `create()` | NO | N/A |
| `update()` | NO | N/A |
| `delete()` | NO | N/A |

### 3.4 Auth Abstraction (IAuthProvider)

| Status | Rationale |
|--------|-----------|
| **PASS** | Direct Supabase client is appropriate for public reference data. |

**Analysis:**
- Currencies are **global reference data** (not user-specific)
- No Row Level Security needed
- All users see identical currency list
- `IAuthProvider` reserved for user-context operations

---

## 4. Performance & Scalability

### 4.1 React Compiler Check

| Pattern | Status | Notes |
|---------|--------|-------|
| `watch()` usage | N/A | No react-hook-form in feature |
| `useWatch()` usage | N/A | No react-hook-form in feature |

### 4.2 Re-render Optimization

| Check | Status | Evidence |
|-------|--------|----------|
| Raw `useEffect` for fetching | NONE | Uses React Query |
| Unbounded `useMemo` | NONE | None present |
| Heavy computations | NONE | Simple pass-through |

### 4.3 Caching Strategy

**Configuration:** [lib/hooks/use-currencies.ts:10-12](lib/hooks/use-currencies.ts#L10-L12)

| Setting | Value | Source | Assessment |
|---------|-------|--------|------------|
| `queryKey` | `['currencies']` | `QUERY_KEYS.CURRENCIES` | Centralized |
| `staleTime` | 600,000ms (10 min) | `QUERY_CONFIG.STALE_TIME.LONG` | OPTIMAL |
| `gcTime` | Default (5 min) | React Query default | Acceptable |

**Rationale:** Currencies rarely change. 10-minute stale time prevents unnecessary refetches while ensuring data stays reasonably fresh.

### 4.4 Query Constants

**Location:** [lib/constants/query.constants.ts:50](lib/constants/query.constants.ts#L50)

```typescript
CURRENCIES: ['currencies'] as const,
```

**Status: COMPLIANT** - Query key is centralized, type-safe with `as const`.

---

## 5. Architecture Assessment

### 5.1 Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE LAYER                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                        global_currencies (Postgres)                         │
│                     ISO 4217 reference data (180+ rows)                     │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ Supabase Query
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             FEATURE LAYER                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  features/currencies/api/currencies.ts                                      │
│  ├── Zod validation (GlobalCurrencyRowSchema)                               │
│  └── Data transformation (dbCurrenciesToDomain)                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ currenciesApi.getAll()
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ORCHESTRATOR LAYER                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  lib/hooks/use-currencies.ts        → Primary hook (React Query wrapper)    │
│  lib/hooks/use-reference-data.ts    → useCurrenciesData() lightweight hook  │
│  lib/hooks/use-currency-manager.ts  → Form state management                 │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ useCurrencies() / useCurrenciesData()
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            COMPONENT LAYER                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  features/accounts/components/add-account-modal.tsx                         │
│  features/settings/components/currency-settings.tsx                         │
│  (Other components that need currency data)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Data Flow (Complete)

```
1. Component calls useCurrencies()
           │
           ▼
2. React Query checks cache (queryKey: ['currencies'])
           │
           ├── Cache HIT & fresh → Return cached Currency[]
           │
           └── Cache MISS or stale →
                      │
                      ▼
3. currenciesApi.getAll() executes
           │
           ▼
4. Supabase query: SELECT * FROM global_currencies ORDER BY code
           │
           ▼
5. Zod validation: z.array(GlobalCurrencyRowSchema).parse(data)
           │
           ├── Validation PASS → Continue
           │
           └── Validation FAIL → Throw ZodError (corrupted response)
                      │
                      ▼
6. Data transformation: dbCurrenciesToDomain(validated)
           │
           ▼
7. Return Currency[] to React Query cache
           │
           ▼
8. Component receives { data: Currency[], isLoading, error }
```

### 5.3 Architectural Strengths

| # | Strength | Evidence |
|---|----------|----------|
| 1 | **Minimal Surface Area** | Single file (32 lines) in feature folder |
| 2 | **Proper Layer Separation** | API in feature, hooks in lib |
| 3 | **Zod Boundary Validation** | HARDENED at network boundary |
| 4 | **Centralized Transformers** | Uses `data-transformers.ts` |
| 5 | **Type Safety** | Zero `any`/`unknown` usage |
| 6 | **Centralized Query Keys** | Uses `QUERY_KEYS.CURRENCIES` |
| 7 | **Optimal Caching** | 10-minute stale time |
| 8 | **ESLint Protection** | Rule prevents feature bleed |
| 9 | **Read-Only Design** | Appropriate for reference data |

### 5.4 ESLint Enforcement

**Location:** [eslint.config.mjs:51-54](eslint.config.mjs#L51-L54)

```javascript
{
  group: ["@/features/currencies/hooks/*", "@/features/currencies/domain/*", "@/features/currencies/services/*"],
  message: "Import from @/lib/hooks/use-reference-data instead of directly from features/currencies."
}
```

**Note:** The rule targets `hooks/*`, `domain/*`, `services/*` but NOT `api/*`. This is intentional — `lib/` is allowed to import from feature APIs.

---

## 6. Complete Code Listing

### 6.1 Feature API Layer

**File:** [features/currencies/api/currencies.ts](features/currencies/api/currencies.ts) (32 lines)

```typescript
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { CURRENCY } from '@/lib/constants';
import { dbCurrenciesToDomain } from '@/lib/data/data-transformers';
import { GlobalCurrencyRowSchema } from '@/lib/data/db-row-schemas';

export const currenciesApi = {
  /**
   * Get all global currencies (read-only, no user filtering needed)
   * HARDENED: Zod validation at network boundary
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

    // HARDENED: Zod validation at network boundary
    const validated = z.array(GlobalCurrencyRowSchema).parse(data ?? []);

    // Transform snake_case to camelCase before returning to frontend
    return dbCurrenciesToDomain(validated);
  },
};
```

### 6.2 Orchestrator Hook

**File:** [lib/hooks/use-currencies.ts](lib/hooks/use-currencies.ts) (15 lines)

```typescript
import { useQuery } from '@tanstack/react-query';
import { currenciesApi } from '@/features/currencies/api/currencies';
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

## 7. Compliance Matrix

| Mandate | Status | Evidence |
|---------|--------|----------|
| Naming (camelCase domain / snake_case DB) | PASS | `Currency` vs `global_currencies` |
| Type Safety (no any/unknown) | PASS | Zero violations across all files |
| Zod Boundary Validation | PASS | `GlobalCurrencyRowSchema` at network boundary |
| Feature Isolation | PASS | Zero cross-feature imports |
| Transformer Usage | PASS | Uses `dbCurrenciesToDomain()` |
| Integer Cents | N/A | No monetary amounts in schema |
| Sync Integrity | N/A | Read-only reference data |
| Soft Deletes | N/A | No delete operations |
| Auth Abstraction | PASS | Direct client appropriate for public data |
| React Query Patterns | PASS | Proper useQuery, centralized keys |
| Caching Strategy | PASS | 10-minute stale time |
| Orchestrator Pattern | PASS | Hook in lib/, API in feature |

---

## 8. Changes Since v2.0

| Item | v2.0 Status | v3.0 Status | Change |
|------|-------------|-------------|--------|
| Feature folder structure | 2 files (api + hooks) | 1 file (api only) | Hooks moved to lib/ |
| Zod validation | MISSING | IMPLEMENTED | GlobalCurrencyRowSchema added |
| Feature bleed violations | 1 violation | 0 violations | All consumers use lib/hooks |
| `useCurrencies` location | `features/currencies/hooks/` | `lib/hooks/` | Orchestrator pattern |

---

## 9. Recommendations

**None.** The currencies feature is now fully compliant with all architectural mandates.

---

*Generated by Technical Audit Process v3.0*
