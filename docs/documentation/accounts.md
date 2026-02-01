# Accounts Feature Documentation

> **Audit Date:** 2026-02-01
> **Auditor:** Domain-Specific Documentation Agent
> **Feature Path:** `features/accounts/`

---

## Overview

| Metric | Value |
|--------|-------|
| Total Files | 25 |
| Architecture | Clean Architecture (Domain → Repository → Service → Hooks → Components) |
| Compliance Status | **S-Tier** |

### File Structure

```
features/accounts/
├── domain/
│   ├── entities.ts          (Re-exports from @/domain/accounts)
│   ├── types.ts             (DTOs and Result types)
│   ├── constants.ts         (Validation rules and error messages)
│   ├── errors.ts            (7 error classes + type guards)
│   └── index.ts             (Central exports)
├── repository/
│   ├── account-repository.interface.ts
│   ├── supabase-account-repository.ts
│   ├── local-account-repository.ts
│   ├── hybrid-account-repository.ts
│   └── index.ts
├── services/
│   ├── account-service.interface.ts
│   ├── account-service.ts
│   └── index.ts
├── hooks/
│   ├── use-account-service.ts
│   ├── use-accounts.ts
│   └── use-account-mutations.ts
├── components/
│   ├── account-list.tsx
│   ├── account-list-item.tsx
│   ├── account-form.tsx
│   ├── add-account-modal.tsx
│   ├── edit-account-modal.tsx
│   ├── delete-account-dialog.tsx
│   └── currency-manager.tsx
├── schemas/
│   └── account.schema.ts
└── index.ts
```

---

## 1. Dependency Map

### External Libraries

| Library | Usage | Compliant |
|---------|-------|-----------|
| `@tanstack/react-query` | Query/mutation hooks | Yes |
| `zod` | Schema validation | Yes |
| `react-hook-form` | Form state management | Yes |
| `sonner` | Toast notifications | Yes |
| `lucide-react` | Icons | Yes |

### Internal Dependencies (from `@/`)

| Import Path | Usage | Compliant |
|-------------|-------|-----------|
| `@/lib/supabase/client` | Supabase client factory | Yes |
| `@/lib/auth/*` | Auth provider interfaces | Yes |
| `@/lib/data/data-transformers` | DB → Domain transformations | Yes |
| `@/lib/data/validate` | Zod validation utilities | Yes |
| `@/lib/data/db-row-schemas` | DB row Zod schemas | Yes |
| `@/lib/constants` | Global constants | Yes |
| `@/lib/errors` | DomainError base class | Yes |
| `@/lib/hooks/*` | Shared hooks | Yes |
| `@/lib/local-db` | WatermelonDB utilities | Yes |
| `@/lib/sync/sync-lock-manager` | Mutation lock pattern | Yes |
| `@/components/ui/*` | UI primitives | Yes |
| `@/components/shared/*` | Shared components | Yes |
| `@/types/supabase` | Supabase type definitions | Yes |
| `@/types/domain` | Domain types | Yes |
| `@/domain/accounts` | Sacred domain entities | Yes |

### Cross-Feature Imports

| Import | Status |
|--------|--------|
| **NONE** | **COMPLIANT** |

> The accounts feature is fully isolated and does not import from any other feature folder (`features/*`).

---

## 2. Schema Compliance

### Zod Schemas Used

#### `createAccountSchema` (features/accounts/schemas/account.schema.ts)

```typescript
z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
})
```

#### `updateAccountSchema` (features/accounts/schemas/account.schema.ts)

```typescript
z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
})
```

#### `BankAccountViewRowSchema` (lib/data/db-row-schemas.ts)

Used at repository boundary to validate raw Supabase rows:

```typescript
z.object({
  id: uuid,
  group_id: uuid,
  user_id: uuid,
  name: z.string(),
  type: AccountTypeEnum,
  currency_code: z.string(),
  color: z.string(),
  is_visible: z.boolean(),
  current_balance_cents: z.number().int(),
  created_at: timestamptz,
  updated_at: timestamptz,
  version: z.number().int().min(0),
  deleted_at: z.string().nullable(),
  global_currencies: z.object({ symbol: z.string() }).nullable(),
})
```

### Supabase Type Mapping

| Database (snake_case) | Domain (camelCase) | Transformer |
|-----------------------|--------------------|-------------|
| `id` | `id` | Direct |
| `user_id` | `userId` | `dbAccountViewToDomain()` |
| `group_id` | `groupId` | `dbAccountViewToDomain()` |
| `name` | `name` | Direct |
| `type` | `type` | Direct |
| `currency_code` | `currencyCode` | `dbAccountViewToDomain()` |
| `color` | `color` | Direct |
| `is_visible` | `isVisible` | `dbAccountViewToDomain()` |
| `current_balance_cents` | `currentBalanceCents` | `dbAccountViewToDomain()` |
| `created_at` | `createdAt` | `dbAccountViewToDomain()` |
| `updated_at` | `updatedAt` | `dbAccountViewToDomain()` |
| `deleted_at` | `deletedAt` | `dbAccountViewToDomain()` |
| `version` | `version` | Direct |
| `global_currencies.symbol` | `currencySymbol` | `dbAccountViewToDomain()` |

**Transformation Location:** `lib/data/data-transformers.ts:313-332`

---

## 3. Entity Audit (Ghost Prop Analysis)

### AccountViewEntity Properties

| Property | Type | Used In | Status |
|----------|------|---------|--------|
| `id` | `string` | `account-list.tsx` (key, onClick), `edit-account-modal.tsx`, `delete-account-dialog.tsx`, mutations | **ACTIVE** |
| `version` | `number` | `edit-account-modal.tsx` (update), `delete-account-dialog.tsx` (delete), optimistic updates | **ACTIVE** |
| `userId` | `string` | Repository layer (RLS filtering) | **ACTIVE** |
| `groupId` | `string` | Repository layer (`getByGroupId` queries) | **ACTIVE** |
| `name` | `string` | `account-list-item.tsx` (display), `edit-account-modal.tsx` (form), `delete-account-dialog.tsx` (confirmation), sorting | **ACTIVE** |
| `type` | `AccountType` | `use-flat-accounts.ts` (sorting by type) | **ACTIVE** |
| `currencyCode` | `string` | `account-list-item.tsx` (display), `edit-account-modal.tsx` (display), sorting | **ACTIVE** |
| `color` | `string` | `account-list-item.tsx` (icon color), `edit-account-modal.tsx` (form) | **ACTIVE** |
| `currentBalanceCents` | `number` | `account-list-item.tsx` (balance display with `formatBalanceCents()`) | **ACTIVE** |
| `isVisible` | `boolean` | `use-flat-accounts.ts` (`.filter(acc => acc.isVisible === true)`) | **ACTIVE** |
| `createdAt` | `string` | **NOT FOUND** | **GHOST PROP** |
| `updatedAt` | `string` | `use-account-mutations.ts` (optimistic update timestamp) | **ACTIVE** |
| `deletedAt` | `string \| null` | Repository layer (tombstone filtering) | **ACTIVE** |
| `currencySymbol` | `string \| null` | Comment only: "CRITICAL: Always use currencyCode (not currencySymbol)" | **DEPRECATED** |

### Ghost Prop Details

#### `createdAt` - GHOST PROP

**Grep Results:** 0 matches in `features/accounts/`

**Analysis:** This property is present in `AccountViewEntity` but has zero usages within the accounts feature. It is not rendered in any component, not used in any business logic, and not used for sorting or filtering.

**Recommendation:**
- Option A: Add `@deprecated` JSDoc with removal timeline
- Option B: Keep for potential audit/display features (document justification)

#### `currencySymbol` - INTENTIONALLY DEPRECATED

**Grep Results:** 1 match (comment warning against usage)

```typescript
// account-list-item.tsx:76
{/* CRITICAL: Always use currencyCode (not currencySymbol) for unambiguous display */}
```

**Analysis:** Per CTO mandate, `currencySymbol` must NEVER be used in UI because symbols are ambiguous (e.g., "$" could be USD, AUD, CAD). The property exists for:
1. Backward compatibility with iOS bridge serialization
2. Potential future edge cases requiring symbol display

**Status:** Intentionally unused per architectural mandate. NOT a violation.

---

## 4. Spaghetti Report

### Component Analysis

| Component | Business Logic | Status |
|-----------|----------------|--------|
| `account-list.tsx` | None - UI state only (modal open/close, expansion toggle) | **CLEAN** |
| `account-list-item.tsx` | None - Display only + event handlers delegated to parent | **CLEAN** |
| `account-form.tsx` | None - Form fields only, validation via Zod schema | **CLEAN** |
| `add-account-modal.tsx` | None - Form + `useCreateAccount().mutateAsync()` | **CLEAN** |
| `edit-account-modal.tsx` | None - Form + `useUpdateAccount().mutateAsync()` | **CLEAN** |
| `delete-account-dialog.tsx` | None - Confirmation + `useDeleteAccount().mutateAsync()` | **CLEAN** |
| `currency-manager.tsx` | None - Selection UI only | **CLEAN** |

### Business Logic Location

All business logic is properly encapsulated in the service layer:

| Logic Type | Location |
|------------|----------|
| Name validation | `AccountService.validateName()` |
| Color validation | `AccountService.validateColor()` |
| Currency count validation | `AccountService.create()` |
| Auth context extraction | `AccountService.getCurrentUserId()` |
| Error translation | `AccountService` (DataResult → throw) |
| Optimistic concurrency | Repository layer (version checking) |
| Tombstone filtering | Repository layer (`deleted_at IS NULL`) |

**Finding:** No business logic leakage detected. All validation and orchestration occurs in the service layer.

---

## 5. Manifesto Compliance Summary

| Rule | Status | Evidence |
|------|--------|----------|
| **Integer Cents Only** | **PASS** | All balances use `currentBalanceCents: number` (integer) |
| **DataResult Pattern** | **PASS** | All repository methods return `AccountDataResult<T>`, never throw |
| **Zero-Any** | **PASS** | No `any`, `as any`, or `@ts-ignore` found in any file |
| **Boundary Mapping** | **PASS** | `dbAccountViewToDomain()` transforms all snake_case → camelCase |
| **No Cross-Feature Imports** | **PASS** | Zero imports from `features/*` other than self |
| **Business Logic Placement** | **PASS** | All logic in services/repository, not components |

---

## 6. Recommendations

### Required Actions

1. **`createdAt` Ghost Prop Resolution**
   - Add to entity definition:
     ```typescript
     /**
      * Creation timestamp (ISO 8601)
      * @deprecated Phase 1.3 - Unused in current UI. Target removal: 2026-Q3
      */
     readonly createdAt: string;
     ```
   - OR: Document explicit justification for retention (e.g., "Reserved for audit log feature")

### Optional Improvements

1. **Schema Consolidation** - Consider moving inline Zod schemas from `add-account-modal.tsx` to `account.schema.ts` for consistency

2. **Type Alias Cleanup** - `delete-account-dialog.tsx` uses `Account` type instead of `AccountViewEntity`. Consider aligning for consistency.

---

## Appendix: File-by-File Audit

| File | Lines | Type Violations | Cross-Feature Imports | Business Logic |
|------|-------|-----------------|----------------------|----------------|
| domain/entities.ts | 19 | 0 | 0 | None |
| domain/types.ts | ~80 | 0 | 0 | Type definitions only |
| domain/constants.ts | ~50 | 0 | 0 | Constants only |
| domain/errors.ts | ~150 | 0 | 0 | Error classes only |
| repository/account-repository.interface.ts | ~50 | 0 | 0 | Interface only |
| repository/supabase-account-repository.ts | 451 | 0 | 0 | Repository pattern |
| repository/local-account-repository.ts | ~300 | 0 | 0 | Repository pattern |
| repository/hybrid-account-repository.ts | ~100 | 0 | 0 | Orchestrator pattern |
| services/account-service.ts | ~150 | 0 | 0 | Business logic |
| hooks/use-account-service.ts | ~40 | 0 | 0 | DI hook |
| hooks/use-accounts.ts | ~60 | 0 | 0 | Query hooks |
| hooks/use-account-mutations.ts | 264 | 0 | 0 | Mutation hooks |
| components/account-list.tsx | 109 | 0 | 0 | None |
| components/account-list-item.tsx | 124 | 0 | 0 | None |
| components/account-form.tsx | ~50 | 0 | 0 | None |
| components/add-account-modal.tsx | ~200 | 0 | 0 | None |
| components/edit-account-modal.tsx | 224 | 0 | 0 | None |
| components/delete-account-dialog.tsx | 57 | 0 | 0 | None |
| components/currency-manager.tsx | ~100 | 0 | 0 | None |
| schemas/account.schema.ts | ~30 | 0 | 0 | Schemas only |

---

*Generated by Domain-Specific Documentation Agent*
