# Composable Manifest: features/currencies

> **Generated:** 2026-02-01
> **Revision:** 4.0 (Post-alignment comprehensive audit)
> **Auditor:** Domain-Specific Documentation Agent
> **Scope:** `/features/currencies/` folder + related orchestrator hooks

---

## Executive Summary

| Category | Status | Notes |
|----------|--------|-------|
| **Variable & Entity Registry** | PASS | 4 properties, all used |
| **Dependency Manifest** | PASS | 0 cross-feature violations |
| **Zod Boundary Validation** | PASS | HARDENED |
| **Transformer Usage** | PASS | Centralized |
| **Result Pattern** | **FAIL** | Throws instead of DataResult<T> |
| **Integer Cents** | N/A | No monetary fields |
| **Boundary Mapping** | N/A | Field names identical |
| **Performance** | PASS | Optimal caching (REFERENCE volatility) |

**Overall Result: PARTIAL PASS (1 violation)**

---

## 1. Variable & Entity Registry

### 1.1 Feature File Inventory

**Total Files in Feature:** 1

| File | Path | Lines | Purpose |
|------|------|-------|---------|
| `currencies.ts` | `features/currencies/api/currencies.ts` | 32 | API layer with Zod validation |

**Architecture Note:** This is a **read-only reference data** feature. Unlike other features, currencies has no `domain/`, `repository/`, `services/`, `hooks/`, or `components/` subfolders. All hooks reside in `lib/hooks/` following the Orchestrator Pattern.

### 1.2 Entity Inventory

| Name | Kind | Location | Lines |
|------|------|----------|-------|
| `Currency` | Interface | `types/domain.ts:170-175` | 6 |
| `GlobalCurrencyRowSchema` | Zod Schema | `lib/data/db-row-schemas.ts:255-260` | 6 |
| `currenciesApi` | API Object | `features/currencies/api/currencies.ts:7-31` | 25 |

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

### 1.3 Ghost Prop Audit (Entity Field Usage)

**Status: PASS - All 4 properties actively used**

| Field | Type | Nullable | Used In | Usage Evidence |
|-------|------|----------|---------|----------------|
| `code` | `string` | No | AddAccountModal, CurrencyManager, filtering | Primary key, selection value |
| `name` | `string` | No | Dropdowns, display | Human-readable labels |
| `symbol` | `string` | No | Amount formatting | Display with monetary values |
| `flag` | `string \| null` | Yes | Currency lists | Visual identifier |

**Consumer Files:**
- `features/accounts/components/add-account-modal.tsx` - Uses: `code`, `name`, `symbol`, `flag`
- `features/settings/components/currency-settings.tsx` - Uses: `code`, `name`, `symbol`
- `lib/hooks/use-currency-manager.ts` - Uses: `code` (filtering)
- `lib/hooks/use-reference-data.ts` - Uses: full `Currency[]`

### 1.4 Database Schema

```typescript
// lib/supabase/database.types.ts
global_currencies: {
  Row: {
    code: string;      // Primary key, ISO 4217
    flag: string | null;
    name: string;
    symbol: string;
  }
  Insert: { ... }
  Update: { ... }
  Relationships: []  // No outbound FKs
}
```

**Inbound Foreign Key References:**

| Referencing Table | Column | Constraint Name |
|-------------------|--------|-----------------|
| `bank_accounts` | `currency_code` | `bank_accounts_currency_code_fkey` |
| `user_settings` | `main_currency` | `user_settings_main_currency_fkey` |
| `transaction_inbox_view` | `currency_original` | (via bank_accounts FK) |
| `transactions_view` | `currency_original` | (via bank_accounts FK) |

---

## 2. Schema Compliance

### 2.1 Zod Boundary Validation

**Status: PASS (HARDENED)**

**Schema Location:** `lib/data/db-row-schemas.ts:255-260`

```typescript
export const GlobalCurrencyRowSchema = z.object({
  code: z.string(),             // ISO 4217 code
  name: z.string(),             // Human-readable name
  symbol: z.string(),           // Currency symbol
  flag: z.string().nullable(),  // Emoji flag or null
});
```

**Validation Point:** `features/currencies/api/currencies.ts:26`

```typescript
// HARDENED: Zod validation at network boundary
const validated = z.array(GlobalCurrencyRowSchema).parse(data ?? []);
```

### 2.2 Type Safety Audit

| Check | Count | Status |
|-------|-------|--------|
| `any` usage | 0 | PASS |
| `as any` usage | 0 | PASS |
| `@ts-ignore` | 0 | PASS |
| `unknown` without guard | 0 | PASS |

**Files Audited:**
- `features/currencies/api/currencies.ts` - CLEAN
- `lib/hooks/use-currencies.ts` - CLEAN
- `lib/hooks/use-currency-manager.ts` - CLEAN
- `lib/data/db-row-schemas.ts` (GlobalCurrencyRowSchema section) - CLEAN
- `lib/data/data-transformers.ts` (dbCurrencyToDomain section) - CLEAN

---

## 3. Dependency Manifest (Spaghetti Report)

### 3.1 Feature Imports Analysis

**File:** `features/currencies/api/currencies.ts`

| Import | Source | Category | Status |
|--------|--------|----------|--------|
| `z` | `zod` | External NPM | ALLOWED |
| `createClient` | `@/lib/supabase/client` | Library | ALLOWED |
| `CURRENCY` | `@/lib/constants` | Library | ALLOWED |
| `dbCurrenciesToDomain` | `@/lib/data/data-transformers` | Library | ALLOWED |
| `GlobalCurrencyRowSchema` | `@/lib/data/db-row-schemas` | Library | ALLOWED |

**Cross-Feature Import Violations: 0**

### 3.2 Orchestrator Layer Analysis

| Hook | Location | Purpose | Imports From |
|------|----------|---------|--------------|
| `useCurrencies()` | `lib/hooks/use-currencies.ts` | Primary currencies hook | `@/features/currencies/api/currencies` (allowed) |
| `useCurrenciesData()` | `lib/hooks/use-reference-data.ts` | Lightweight alternative | `@/features/currencies/api/currencies` (allowed) |
| `useCurrencyManager()` | `lib/hooks/use-currency-manager.ts` | Form state management | `@/lib/hooks/use-currencies` (allowed) |

### 3.3 Consumer Compliance

| Consumer | Import | Source | Status |
|----------|--------|--------|--------|
| `features/accounts/components/add-account-modal.tsx` | `useCurrencies` | `@/lib/hooks/use-currencies` | COMPLIANT |
| `features/settings/components/currency-settings.tsx` | `useCurrenciesData` | `@/lib/hooks/use-reference-data` | COMPLIANT |

**No feature imports directly from `@/features/currencies` - all use orchestrator hooks.**

### 3.4 Business Logic Location

**Status: PASS - No business logic leaking into React components**

| Component | Business Logic | Location | Assessment |
|-----------|----------------|----------|------------|
| `add-account-modal.tsx` | Currency filtering | `useCurrencyManager()` hook | COMPLIANT |
| `currency-settings.tsx` | Currency display | None (pure presentation) | COMPLIANT |

All business logic properly extracted to:
- `lib/hooks/use-currency-manager.ts` - Form state, filtering, validation

---

## 4. Project Rules Compliance

### 4.1 Integer Cents Only

| Status | Rationale |
|--------|-----------|
| **N/A** | `global_currencies` contains no monetary amounts. Fields are: `code`, `name`, `symbol`, `flag`. |

### 4.2 Result Pattern (DataResult<T>)

| Status | Finding |
|--------|---------|
| **FAIL** | `currenciesApi.getAll()` throws errors instead of returning `DataResult<Currency[]>` |

**Current Implementation (VIOLATION):**

```typescript
// features/currencies/api/currencies.ts:20-23
if (error) {
  console.error(CURRENCY.API.CONSOLE.FETCH_CURRENCIES, error);
  throw new Error(error.message || CURRENCY.API.ERRORS.FETCH_ALL_FAILED);
}
```

**Expected Pattern:**

```typescript
// Should return DataResult<Currency[]>
if (error) {
  return {
    success: false,
    data: null,
    error: new Error(error.message || CURRENCY.API.ERRORS.FETCH_ALL_FAILED),
  };
}
return { success: true, data: dbCurrenciesToDomain(validated) };
```

**Severity:** LOW - Read-only reference data, error thrown is caught by React Query. However, violates MANIFESTO Rule 4.

### 4.3 Zero-Any Compliance

| Status | Evidence |
|--------|----------|
| **PASS** | Zero violations across all currencies-related files |

### 4.4 Boundary Mapping (snake_case to camelCase)

| Status | Rationale |
|--------|-----------|
| **N/A** | Database columns (`code`, `name`, `symbol`, `flag`) already match domain field names. No transformation needed. |

**Transformer Implementation (Passthrough):**

```typescript
// lib/data/data-transformers.ts:134-143
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

### 4.5 No Cross-Feature Imports

| Status | Evidence |
|--------|----------|
| **PASS** | Zero cross-feature imports in currencies API |

---

## 5. Performance & Architecture

### 5.1 Caching Strategy

**Configuration:** `lib/hooks/use-currencies.ts:10-15`

```typescript
export function useCurrencies() {
  return useQuery({
    queryKey: QUERY_KEYS.CURRENCIES,
    queryFn: currenciesApi.getAll,
    ...createQueryOptions('REFERENCE'),  // 24h gcTime for iOS hydration
  });
}
```

| Setting | Value | Source | Assessment |
|---------|-------|--------|------------|
| `queryKey` | `['currencies']` | `QUERY_KEYS.CURRENCIES` | Centralized |
| Volatility | `REFERENCE` | `createQueryOptions()` | OPTIMAL |
| gcTime | 24 hours | Volatility Engine | iOS-optimized |

### 5.2 Dependency Graph

```
DATABASE LAYER
+---------------------------------------------------------+
|              global_currencies (PostgreSQL)              |
|              ISO 4217 reference data (~180 rows)         |
+--------------------------+------------------------------+
                           | Supabase Query
                           v
FEATURE LAYER
+---------------------------------------------------------+
|  features/currencies/api/currencies.ts                   |
|  +-- Zod validation (GlobalCurrencyRowSchema)            |
|  +-- Data transformation (dbCurrenciesToDomain)          |
+--------------------------+------------------------------+
                           | currenciesApi.getAll()
                           v
ORCHESTRATOR LAYER
+---------------------------------------------------------+
|  lib/hooks/use-currencies.ts      -> Primary hook        |
|  lib/hooks/use-reference-data.ts  -> useCurrenciesData() |
|  lib/hooks/use-currency-manager.ts-> Form state mgmt     |
+--------------------------+------------------------------+
                           |
                           v
COMPONENT LAYER
+---------------------------------------------------------+
|  features/accounts/components/add-account-modal.tsx      |
|  features/settings/components/currency-settings.tsx      |
+---------------------------------------------------------+
```

---

## 6. Compliance Summary

| Rule | Status | Evidence |
|------|--------|----------|
| Integer Cents Only | N/A | No monetary fields |
| Result Pattern (DataResult<T>) | **FAIL** | Throws Error instead of returning DataResult |
| Zero-Any | PASS | 0 violations |
| Boundary Mapping | N/A | Field names already match |
| No Cross-Feature Imports | PASS | 0 violations |
| Zod Boundary Validation | PASS | HARDENED |
| Transformer Usage | PASS | Uses centralized `dbCurrenciesToDomain()` |
| Orchestrator Pattern | PASS | Hooks in `lib/`, API in `features/` |
| Query Key Centralization | PASS | Uses `QUERY_KEYS.CURRENCIES` |
| Ghost Props | PASS | All 4 properties actively used |
| Spaghetti Report | PASS | No business logic in components |

---

## 7. Recommendations

### 7.1 MUST FIX: Result Pattern Violation

**Priority:** Medium
**Effort:** Low

Refactor `currenciesApi.getAll()` to return `DataResult<Currency[]>`:

```typescript
import type { DataResult } from '@/lib/data-patterns/types';

export const currenciesApi = {
  getAll: async (): Promise<DataResult<Currency[]>> => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('global_currencies')
      .select('*')
      .order('code', { ascending: true });

    if (error) {
      console.error(CURRENCY.API.CONSOLE.FETCH_CURRENCIES, error);
      return {
        success: false,
        data: null,
        error: new Error(error.message || CURRENCY.API.ERRORS.FETCH_ALL_FAILED),
      };
    }

    const validated = z.array(GlobalCurrencyRowSchema).parse(data ?? []);
    return {
      success: true,
      data: dbCurrenciesToDomain(validated),
    };
  },
};
```

**Impact:** Requires updating `useCurrencies()` to handle DataResult:

```typescript
export function useCurrencies() {
  return useQuery({
    queryKey: QUERY_KEYS.CURRENCIES,
    queryFn: async () => {
      const result = await currenciesApi.getAll();
      if (!result.success) throw result.error;
      return result.data;
    },
    ...createQueryOptions('REFERENCE'),
  });
}
```

### 7.2 NO ACTION NEEDED

The following items are correctly implemented and require no changes:

1. **Ghost Props:** All 4 properties are actively used
2. **Cross-Feature Imports:** Zero violations
3. **Zod Validation:** HARDENED at network boundary
4. **Caching:** Optimal REFERENCE volatility (24h gcTime)
5. **Orchestrator Pattern:** Correctly structured
6. **Business Logic:** Properly extracted to hooks

---

## 8. Complete Code Listing

### 8.1 Feature API Layer

**File:** `features/currencies/api/currencies.ts` (32 lines)

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

### 8.2 Orchestrator Hook

**File:** `lib/hooks/use-currencies.ts` (17 lines)

```typescript
import { useQuery } from '@tanstack/react-query';
import { currenciesApi } from '@/features/currencies/api/currencies';
import { QUERY_KEYS, createQueryOptions } from '@/lib/constants';

/**
 * Hook to fetch all global currencies (read-only)
 *
 * Uses REFERENCE volatility: 24h gcTime for instant hydration on iOS.
 */
export function useCurrencies() {
  return useQuery({
    queryKey: QUERY_KEYS.CURRENCIES,
    queryFn: currenciesApi.getAll,
    ...createQueryOptions('REFERENCE'),
  });
}
```

---

*Generated by Domain-Specific Documentation Agent v4.0*
