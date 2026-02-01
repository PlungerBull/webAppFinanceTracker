# Settings Feature Audit

> **Audit Date**: 2026-02-01
> **Auditor**: Claude Code
> **Feature Path**: `features/settings/`

---

## Overview

The settings feature provides user preference management including:
- Main currency selection
- Transaction sort preference
- Account visibility in sidebar
- Profile management (name, email, password)
- Data import/export
- Data clearing (danger zone)

**File Count**: 8 files (2 deprecated re-exports)

---

## Dependency Map

### External Imports Summary

| Source | Files Using | Compliant |
|--------|-------------|-----------|
| `@/lib/hooks/use-reference-data` | appearance-settings, currency-settings | Yes |
| `@/lib/auth/*` | user-settings, data-management | Yes |
| `@/lib/data/*` | user-settings | Yes |
| `@/lib/constants` | all files | Yes |
| `@/lib/supabase/client` | hooks, data-management | Yes |
| `@/lib/schemas/profile.schema` | profile-settings | Yes |
| `@/domain/auth` | profile-settings | Yes |
| `@tanstack/react-query` | hooks | Yes |
| `react-hook-form` | profile-settings | Yes |
| `sonner` | use-update-account-visibility | Yes |
| `lucide-react` | components | Yes |

### Cross-Feature Import Violations

| File | Import Source | Severity |
|------|---------------|----------|
| [data-management.tsx:94](features/settings/components/data-management.tsx#L94) | `@/features/import-export/services/data-import-service` | **Low** - Lazy import for code splitting |
| [data-management.tsx:178](features/settings/components/data-management.tsx#L178) | `@/features/import-export/services/data-export-service` | **Low** - Lazy import for code splitting |
| [reconciliation-settings.tsx](features/settings/components/reconciliation-settings.tsx) | `@/features/reconciliations/components/settings/` | **Medium** - Deprecated re-export |
| [reconciliation-form-modal.tsx](features/settings/components/reconciliation-form-modal.tsx) | `@/features/reconciliations/components/settings/` | **Medium** - Deprecated re-export |

**Recommendation**: The lazy imports for import-export are acceptable for bundle optimization. The deprecated re-exports should be removed once all consumers migrate to the reconciliations feature path.

---

## Schema Compliance

### Zod Schema: `UserSettingsRowSchema`

**Location**: [lib/data/db-row-schemas.ts:217-225](lib/data/db-row-schemas.ts#L217-L225)

```typescript
export const UserSettingsRowSchema = z.object({
  user_id: uuid,
  main_currency: z.string().nullable(),
  start_of_week: z.number().int().nullable(),
  theme: z.string().nullable(),
  transaction_sort_preference: z.string(),
  created_at: timestamptz,
  updated_at: timestamptz,
});
```

### Domain Type: `UserSettings`

**Location**: [types/domain.ts:181-189](types/domain.ts#L181-L189)

```typescript
export interface UserSettings {
  userId: string;
  mainCurrency: string | null;
  startOfWeek: number | null;
  theme: string | null;
  transactionSortPreference: 'date' | 'created_at';
  createdAt: string;
  updatedAt: string;
}
```

### Schema-to-Type Mapping

| DB Column (snake_case) | Domain Property (camelCase) | Type | Validated |
|------------------------|----------------------------|------|-----------|
| `user_id` | `userId` | `string` | Yes (uuid) |
| `main_currency` | `mainCurrency` | `string \| null` | Yes |
| `start_of_week` | `startOfWeek` | `number \| null` | Yes (int) |
| `theme` | `theme` | `string \| null` | Yes |
| `transaction_sort_preference` | `transactionSortPreference` | `'date' \| 'created_at'` | Yes* |
| `created_at` | `createdAt` | `string` | Yes |
| `updated_at` | `updatedAt` | `string` | Yes |

*Note: Schema uses `z.string()` but domain narrows to union type via cast in transformer.

**Transformer**: [lib/data/data-transformers.ts:779-791](lib/data/data-transformers.ts#L779-L791)

---

## Entity Audit (Ghost Props)

### UserSettings Entity

| Property | Component Usage | Hook Usage | Status |
|----------|----------------|------------|--------|
| `userId` | None | RLS context only | **Ghost** (Acceptable - internal) |
| `mainCurrency` | [appearance-settings.tsx:49,63,99](features/settings/components/appearance-settings.tsx#L49) | useUserSettings | **Active** |
| `startOfWeek` | None | None | **Ghost** (Future feature) |
| `theme` | None | None | **Ghost** (Future feature) |
| `transactionSortPreference` | None direct | useUpdateSortPreference | **Active** (via mutation) |
| `createdAt` | None | None | **Ghost** (Audit metadata) |
| `updatedAt` | None | None | **Ghost** (Audit metadata) |

### Ghost Prop Summary

- **Total Properties**: 7
- **Active Properties**: 2 (`mainCurrency`, `transactionSortPreference`)
- **Ghost Properties**: 5
- **Ghost Ratio**: 71%

### Ghost Prop Justification

| Property | Reason | Action |
|----------|--------|--------|
| `userId` | Internal RLS field, never exposed to UI | Keep - Required for DB operations |
| `startOfWeek` | Planned feature: week-based reporting | Keep - Roadmap item |
| `theme` | Planned feature: dark/light mode toggle | Keep - Roadmap item |
| `createdAt` | Standard audit trail field | Keep - Audit compliance |
| `updatedAt` | Standard audit trail field | Keep - Audit compliance |

---

## Spaghetti Report

### Business Logic in Components

#### Violation 1: Direct Supabase RPC in Component

**File**: [data-management.tsx:34-56](features/settings/components/data-management.tsx#L34-L56)

```typescript
const handleClearData = async () => {
  const userId = await authProvider.getCurrentUserId();
  const { error } = await supabase.rpc('clear_user_data', { p_user_id: userId });
  // ...
};
```

**Severity**: Minor
**Issue**: Component directly calls Supabase RPC instead of delegating to service layer
**Recommendation**: Extract to `DataManagementService.clearUserData()`

#### Violation 2: Direct Supabase in Hook

**File**: [use-update-account-visibility.ts:16-23](features/settings/hooks/use-update-account-visibility.ts#L16-L23)

```typescript
const promises = updates.map(({ accountId, isVisible }) =>
  supabase
    .from('bank_accounts')
    .update({ is_visible: isVisible })
    .eq('id', accountId)
);
```

**Severity**: Minor
**Issue**: Hook mutation contains direct Supabase queries
**Recommendation**: Extract to `AccountVisibilityRepository` or `AccountService`

### Compliant Patterns (Positive Examples)

| Component | Pattern | Notes |
|-----------|---------|-------|
| [appearance-settings.tsx](features/settings/components/appearance-settings.tsx) | S-TIER derived state | Derives UI state from server + local, delegates to hooks |
| [profile-settings.tsx](features/settings/components/profile-settings.tsx) | Service delegation | Uses `getAuthApi().updateUserMetadata()` |
| [currency-settings.tsx](features/settings/components/currency-settings.tsx) | Pure presentational | Props in, callbacks out, no business logic |
| [use-user-settings.ts](features/settings/hooks/use-user-settings.ts) | Proper service layer | Delegates to `UserSettingsService` |

---

## Rule Compliance Summary

| Rule | Status | Evidence |
|------|--------|----------|
| **Integer Cents Only** | **PASS** | No monetary fields in settings domain |
| **Result Pattern (DataResult<T>)** | **VIOLATION** | [user-settings.ts:27-30](features/settings/api/user-settings.ts#L27-L30) throws errors |
| **Zero-Any** | **PASS** | No `any`, `as any`, or `@ts-ignore` found |
| **Boundary Mapping** | **PASS** | Uses `dbUserSettingsToDomain()` transformer |
| **No Cross-Feature Imports** | **VIOLATION** | Lazy imports and deprecated re-exports (see Dependency Map) |

### Result Pattern Violation Details

**File**: [api/user-settings.ts](features/settings/api/user-settings.ts)

**Current Implementation**:
```typescript
async getSettings() {
  const { data, error } = await this.supabase.from('user_settings').select('*').single();
  if (error) {
    throw new Error(error.message || 'Failed to fetch user settings');
  }
  return dbUserSettingsToDomain(validated);
}
```

**Expected Pattern**:
```typescript
async getSettings(): Promise<DataResult<UserSettings>> {
  const { data, error } = await this.supabase.from('user_settings').select('*').single();
  if (error) {
    return { success: false, data: null, error: new DomainError('FETCH_FAILED', error.message) };
  }
  return { success: true, data: dbUserSettingsToDomain(validated) };
}
```

**Mitigation**: React Query hooks provide error boundary handling, reducing impact of missing Result pattern.

---

## File Inventory

| File | Type | LOC | Purpose |
|------|------|-----|---------|
| [api/user-settings.ts](features/settings/api/user-settings.ts) | Service | 85 | User settings CRUD operations |
| [hooks/use-user-settings.ts](features/settings/hooks/use-user-settings.ts) | Hook | 59 | React Query hooks for settings |
| [hooks/use-update-account-visibility.ts](features/settings/hooks/use-update-account-visibility.ts) | Hook | 37 | Account visibility mutations |
| [components/appearance-settings.tsx](features/settings/components/appearance-settings.tsx) | Component | 206 | Sidebar & currency UI |
| [components/currency-settings.tsx](features/settings/components/currency-settings.tsx) | Component | ~60 | Currency selector dropdown |
| [components/profile-settings.tsx](features/settings/components/profile-settings.tsx) | Component | ~100 | Profile/auth management |
| [components/data-management.tsx](features/settings/components/data-management.tsx) | Component | 241 | Import/export/clear data |
| [components/reconciliation-settings.tsx](features/settings/components/reconciliation-settings.tsx) | Re-export | 5 | Deprecated backward compat |
| [components/reconciliation-form-modal.tsx](features/settings/components/reconciliation-form-modal.tsx) | Re-export | 5 | Deprecated backward compat |

---

## Recommendations

### Priority 1: Result Pattern Compliance

Refactor `UserSettingsService` to return `DataResult<T>`:

```typescript
import { DataResult } from '@/lib/data-patterns/types';
import { DomainError } from '@/lib/errors/domain-error';

async getSettings(): Promise<DataResult<UserSettings>> {
  const { data, error } = await this.supabase
    .from('user_settings')
    .select('*')
    .single();

  if (error) {
    return {
      success: false,
      data: null,
      error: new DomainError('USER_SETTINGS_FETCH_FAILED', error.message)
    };
  }

  const validated = validateOrThrow(UserSettingsRowSchema, data, 'UserSettingsRow');
  return { success: true, data: dbUserSettingsToDomain(validated) };
}
```

### Priority 2: Remove Deprecated Re-exports

Delete after verifying no remaining consumers:
- `features/settings/components/reconciliation-settings.tsx`
- `features/settings/components/reconciliation-form-modal.tsx`

### Priority 3: Extract Business Logic

1. Create `DataManagementService`:
   ```typescript
   class DataManagementService {
     async clearUserData(userId: string): Promise<DataResult<void>>
   }
   ```

2. Create `AccountVisibilityRepository`:
   ```typescript
   class AccountVisibilityRepository {
     async updateBulk(updates: AccountVisibilityUpdate[]): Promise<DataResult<void>>
   }
   ```

### Priority 4 (Future): Activate Ghost Props

When implementing roadmap features:
- `startOfWeek`: Week-based reporting and calendar start
- `theme`: Dark/light mode toggle

---

## Architecture Diagram

```
features/settings/
├── api/
│   └── user-settings.ts          # Service Layer (VIOLATION: throws, not DataResult)
│       ├── getSettings()
│       ├── updateMainCurrency()
│       └── updateSortPreference()
│
├── hooks/
│   ├── use-user-settings.ts      # React Query wrapper (Compliant)
│   │   ├── useUserSettings()
│   │   ├── useUpdateMainCurrency()
│   │   └── useUpdateSortPreference()
│   │
│   └── use-update-account-visibility.ts  # Direct Supabase (Minor violation)
│
└── components/
    ├── appearance-settings.tsx   # S-TIER derived state pattern
    ├── currency-settings.tsx     # Pure presentational
    ├── profile-settings.tsx      # Form with service delegation
    ├── data-management.tsx       # Direct RPC (Minor violation)
    └── [deprecated re-exports]
```

---

## Audit Metadata

- **Manifesto Version**: Current (docs/MANIFESTO.md)
- **AI Context Version**: Current (docs/AI_CONTEXT.md)
- **Supabase Types**: Generated (types/supabase.ts)
- **Transformer Source**: lib/data/data-transformers.ts
