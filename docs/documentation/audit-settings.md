# Technical Audit Manifest: features/settings

**Audit Date:** 2026-01-28
**Auditor:** Claude Opus 4.5
**Scope:** `/features/settings/` folder

---

## 1. Variable & Entity Registry

### Entity Inventory

| Entity/Interface | File | Type | Purpose |
|------------------|------|------|---------|
| `UserSettings` | `@/lib/types/domain.ts` | Domain Interface | User preferences (currency, theme, sort) |
| `Reconciliation` | `@/lib/types/domain.ts` | Domain Interface | Audit record linking bank statements to ledger |
| `ReconciliationStatus` | `@/lib/types/domain.ts` | Type | `'draft' \| 'completed'` |
| `UserSettingsRowSchema` | `@/lib/data/db-row-schemas.ts` | Zod Schema | Database row validation |
| `UpdateProfileFormData` | `@/features/auth/schemas/profile.schema` | DTO | Profile update payload |
| `ReconciliationFormData` | `reconciliation-form-modal.tsx:45` | DTO (inline) | Form data for reconciliation CRUD |
| `CurrencySettingsProps` | `currency-settings.tsx` | Interface | Props for currency selector |
| `ProfileSettingsProps` | `profile-settings.tsx:18` | Interface | Props for profile component |
| `ReconciliationFormModalProps` | `reconciliation-form-modal.tsx:47` | Interface | Props for reconciliation modal |

### Naming Audit

| Pattern | Convention | Status |
|---------|------------|--------|
| Domain objects | camelCase | COMPLIANT |
| Database columns | snake_case | COMPLIANT |

**Examples:**
- Domain: `isVisible`, `firstName`, `lastName`, `mainCurrency`, `beginningBalance`
- Database: `main_currency`, `user_id`, `is_visible`, `transaction_sort_preference`, `created_at`

### Type Safety Violations

| File | Line | Issue | Severity |
|------|------|-------|----------|
| [profile-settings.tsx:19](../features/settings/components/profile-settings.tsx#L19) | 19 | `user: any` - Props interface uses `any` instead of Supabase `User` type | HIGH |
| [appearance-settings.tsx:77](../features/settings/components/appearance-settings.tsx#L77) | 77 | `Promise<any>[]` - Promise array typed as `any` | MEDIUM |

---

## 2. Dependency Manifest (Import Audit)

### Feature Bleed Violations

Features should only import from `lib/`, `components/shared`, or their own subfolders. The following violations were found:

| File | Line | Imported From | Violation Type |
|------|------|---------------|----------------|
| [appearance-settings.tsx:4](../features/settings/components/appearance-settings.tsx#L4) | 4 | `@/features/accounts/hooks/use-accounts` | Cross-feature import |
| [profile-settings.tsx:7-8](../features/settings/components/profile-settings.tsx#L7) | 7-8 | `@/features/auth/schemas/profile.schema` | Cross-feature import |
| [profile-settings.tsx:10](../features/settings/components/profile-settings.tsx#L10) | 10 | `@/features/auth/api/auth` | Cross-feature import |
| [reconciliation-settings.tsx:6-10](../features/settings/components/reconciliation-settings.tsx#L6) | 6-10 | `@/features/reconciliations/hooks/use-reconciliations` | Cross-feature import |
| [reconciliation-settings.tsx:11](../features/settings/components/reconciliation-settings.tsx#L11) | 11 | `@/features/accounts/hooks/use-accounts` | Cross-feature import |
| [data-management.tsx](../features/settings/components/data-management.tsx) | 94 (dynamic) | `@/features/import-export/services/data-import-service` | Cross-feature import |
| [data-management.tsx](../features/settings/components/data-management.tsx) | 178 (dynamic) | `@/features/import-export/services/data-export-service` | Cross-feature import |
| [reconciliation-form-modal.tsx:28](../features/settings/components/reconciliation-form-modal.tsx#L28) | 28 | `@/features/accounts/hooks/use-accounts` | Cross-feature import |
| [reconciliation-form-modal.tsx:29-33](../features/settings/components/reconciliation-form-modal.tsx#L29) | 29-33 | `@/features/reconciliations/hooks/use-reconciliations` | Cross-feature import |
| [currency-settings.tsx:3](../features/settings/components/currency-settings.tsx#L3) | 3 | `@/features/currencies/hooks/use-currencies` | Cross-feature import |

**Total Violations:** 10

### Transformer Check

| File | Line | Transformer Used | Status |
|------|------|------------------|--------|
| [user-settings.ts:4](../features/settings/api/user-settings.ts#L4) | 4, 32, 53, 74 | `dbUserSettingsToDomain` from `@/lib/data/data-transformers` | COMPLIANT |

No inline mapping logic detected.

---

## 3. Sacred Mandate Compliance

### Integer Cents Violations

| File | Line | Issue | Severity |
|------|------|-------|----------|
| [reconciliation-settings.tsx:173](../features/settings/components/reconciliation-settings.tsx#L173) | 173 | `reconciliation.beginningBalance.toFixed(2)` - Direct floating-point formatting | HIGH |
| [reconciliation-settings.tsx:184](../features/settings/components/reconciliation-settings.tsx#L184) | 184 | `reconciliation.endingBalance.toFixed(2)` - Direct floating-point formatting | HIGH |
| [reconciliation-form-modal.tsx:191](../features/settings/components/reconciliation-form-modal.tsx#L191) | 191 | `step="0.01"` - Input allows direct floating-point entry for `beginningBalance` | HIGH |
| [reconciliation-form-modal.tsx:204](../features/settings/components/reconciliation-form-modal.tsx#L204) | 204 | `step="0.01"` - Input allows direct floating-point entry for `endingBalance` | HIGH |

**Root Cause:** Monetary values (`beginningBalance`, `endingBalance`) are handled as floats without conversion to cents using `toCents()`/`fromCents()`.

### Sync Integrity

| File | Lines | Operation | Version Bump | Status |
|------|-------|-----------|--------------|--------|
| [user-settings.ts](../features/settings/api/user-settings.ts) | 43, 64 | UPDATE | None | NOT IMPLEMENTED |
| [use-update-account-visibility.ts](../features/settings/hooks/use-update-account-visibility.ts) | 19 | UPDATE | None | NOT IMPLEMENTED |

**Note:** No explicit version/revision tracking for Delta Sync Engine detected. This is not a violation if sync is not enabled for these tables, but should be verified.

### Soft Deletes

| Pattern | Status |
|---------|--------|
| Physical DELETE operations | NONE FOUND |
| `deleted_at` tombstone usage | N/A (no deletes in this feature) |

**Status:** COMPLIANT

**Note:** [data-management.tsx](../features/settings/components/data-management.tsx) uses RPC function `clear_user_data()` which is an intentional data clearing mechanism, not a normal delete pattern.

### Auth Abstraction

| File | Line | Pattern Used | Status |
|------|------|--------------|--------|
| [user-settings.ts:2-3](../features/settings/api/user-settings.ts#L2) | 2-3 | `IAuthProvider` interface imported | COMPLIANT |
| [user-settings.ts:11](../features/settings/api/user-settings.ts#L11) | 11 | `authProvider` injected via constructor | COMPLIANT |
| [user-settings.ts:15](../features/settings/api/user-settings.ts#L15) | 15 | `authProvider.getCurrentUserId()` used | COMPLIANT |
| [user-settings.ts:82](../features/settings/api/user-settings.ts#L82) | 82 | Factory creates `SupabaseAuthProvider` | COMPLIANT |

**Status:** COMPLIANT - No direct `supabase.auth.getUser()` calls detected.

---

## 4. Performance & Scalability

### React Compiler Check (watch vs useWatch)

| File | Line | Pattern Used | Status |
|------|------|--------------|--------|
| [reconciliation-form-modal.tsx:4](../features/settings/components/reconciliation-form-modal.tsx#L4) | 4 | `import { useForm, useWatch }` | COMPLIANT |
| [reconciliation-form-modal.tsx:75-89](../features/settings/components/reconciliation-form-modal.tsx#L75) | 75-89 | `useWatch({ control, name })` for `dateStart`, `dateEnd`, `accountId` | COMPLIANT |

**Status:** COMPLIANT - All watch operations use React Compiler-compatible `useWatch`.

### Re-render Optimization

| File | Issue | Severity |
|------|-------|----------|
| [appearance-settings.tsx:46-63](../features/settings/components/appearance-settings.tsx#L46) | `useEffect` with complex dependency array (pendingVisibility, selectedCurrency, userSettings, accounts) runs on every change | LOW |
| [reconciliation-settings.tsx](../features/settings/components/reconciliation-settings.tsx) | No virtualization for potentially large reconciliation lists | LOW |

---

## 5. File Structure & Exports

### Folder Structure

```
features/settings/
├── api/
│   └── user-settings.ts           # Service class for user settings CRUD
├── components/
│   ├── appearance-settings.tsx    # Account visibility & currency display
│   ├── currency-settings.tsx      # Reusable currency selector
│   ├── data-management.tsx        # Import/export & clear data
│   ├── profile-settings.tsx       # User profile & security settings
│   ├── reconciliation-form-modal.tsx  # Create/edit reconciliation modal
│   └── reconciliation-settings.tsx    # Reconciliation list & management
└── hooks/
    ├── use-update-account-visibility.ts  # Bulk visibility mutation
    └── use-user-settings.ts              # Settings query & mutations
```

### Export Summary

| File | Export | Type | Purpose |
|------|--------|------|---------|
| `api/user-settings.ts` | `UserSettingsService` | Class | Service for settings CRUD |
| `api/user-settings.ts` | `createUserSettingsService()` | Factory Function | DI wrapper |
| `components/appearance-settings.tsx` | `AppearanceSettings` | Component | Account visibility + currency UI |
| `components/currency-settings.tsx` | `CurrencySettings` | Component | Reusable currency selector |
| `components/data-management.tsx` | `DataManagement` | Component | Import/export/clear UI |
| `components/profile-settings.tsx` | `ProfileSettings` | Component | Profile management UI |
| `components/reconciliation-form-modal.tsx` | `ReconciliationFormModal` | Component | Reconciliation CRUD modal |
| `components/reconciliation-settings.tsx` | `ReconciliationSettings` | Component | Reconciliation list UI |
| `hooks/use-user-settings.ts` | `useUserSettings()` | Hook | Query settings |
| `hooks/use-user-settings.ts` | `useUpdateMainCurrency()` | Hook | Mutate currency |
| `hooks/use-user-settings.ts` | `useUpdateSortPreference()` | Hook | Mutate sort preference |
| `hooks/use-update-account-visibility.ts` | `useUpdateAccountVisibility()` | Hook | Bulk visibility mutation |

---

## 6. Compliance Summary

| Category | Status | Issues |
|----------|--------|--------|
| Naming Conventions | COMPLIANT | 0 |
| Type Safety | VIOLATIONS | 2 issues (`any` types) |
| Feature Bleed | VIOLATIONS | 10 cross-feature imports |
| Transformer Usage | COMPLIANT | Using `@/lib/data/data-transformers` |
| Integer Cents | VIOLATIONS | 4 floating-point monetary operations |
| Sync Integrity | NOT VERIFIED | No version bumps detected |
| Soft Deletes | COMPLIANT | No physical DELETEs |
| Auth Abstraction | COMPLIANT | `IAuthProvider` properly used |
| React Compiler | COMPLIANT | `useWatch` used correctly |
| Re-render Optimization | LOW RISK | 2 minor concerns |

---

## 7. Recommended Fixes (Priority Order)

### HIGH Priority

1. **Integer Cents Conversion** - Replace floating-point balance handling:
   - `reconciliation-settings.tsx:173,184` - Use `fromCents(reconciliation.beginningBalance)` for display
   - `reconciliation-form-modal.tsx` - Convert input values with `toCents()` before save

2. **Type Safety** - Replace `any` types:
   - `profile-settings.tsx:19` - Import and use Supabase `User` type
   - `appearance-settings.tsx:77` - Type as `Promise<void>[]` or specific union

### MEDIUM Priority

3. **Feature Bleed Resolution** - Consider:
   - Creating shared hooks in `lib/` for cross-feature dependencies
   - Or establishing explicit "feature contracts" for allowed imports
   - Key candidates: `useAccounts`, `useCurrencies`, `useReconciliations`

### LOW Priority

4. **Performance** - Consider:
   - Memoizing change detection logic in `appearance-settings.tsx`
   - Adding virtualization for reconciliation lists if they grow large

---

## 8. Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│  UI LAYER: React Components                             │
│  AppearanceSettings, ProfileSettings, DataManagement    │
│  ReconciliationSettings, ReconciliationFormModal        │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  HOOKS LAYER: React Query Integration                   │
│  useUserSettings, useUpdateMainCurrency                 │
│  useUpdateAccountVisibility, useUpdateSortPreference    │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  SERVICE LAYER: Business Logic                          │
│  UserSettingsService (DI: Supabase + AuthProvider)      │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  DATA LAYER: Supabase + RLS                             │
│  Tables: user_settings, bank_accounts, reconciliations  │
│  Validation: Zod schemas at boundary                    │
│  Transform: dbUserSettingsToDomain()                    │
└─────────────────────────────────────────────────────────┘
```

---

**End of Audit Manifest**
