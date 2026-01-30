# Composable Manifest: features/accounts

> **Generated**: 2026-01-30 (Updated)
> **Auditor**: Senior Systems Architect & Security Auditor
> **Scope**: `/features/accounts/` folder
> **Revision**: 2.0 - Post-alignment comprehensive audit

---

## Executive Summary

| Category | Status | Issues | Change |
|----------|--------|--------|--------|
| Entity Registry | COMPLIANT | 0 | - |
| Naming Conventions | COMPLIANT | 0 | - |
| Type Safety | COMPLIANT | 0 | - |
| Dependency Manifest | **VIOLATION** | 1 | Reduced from 2 |
| Transformer Usage | COMPLIANT | 0 | - |
| Integer Cents | COMPLIANT | 0 | - |
| Sync Integrity | COMPLIANT | 0 | - |
| Soft Deletes | COMPLIANT | 0 | - |
| Auth Abstraction | COMPLIANT | 0 | - |
| React Compiler | COMPLIANT | 0 | - |
| Re-render Optimization | **WARNING** | 2 | NEW |
| Query Patterns | COMPLIANT | 0 | - |

**Overall Grade: A-**
- 1 Feature Bleed violation (cross-feature import)
- 2 Performance warnings (missing memoization)

---

## 1. Variable & Entity Registry

### 1.1 Complete File Inventory

**Total: 25 TypeScript/TSX files (~3,752 lines of code)**

#### Domain Layer (5 files, ~469 lines)
| File | Lines | Purpose |
|------|-------|---------|
| `domain/entities.ts` | 18 | Re-exports from `@/domain/accounts` (backward compatibility) |
| `domain/types.ts` | 129 | DTOs, result types, filters |
| `domain/errors.ts` | 209 | 7 error classes + 5 type guards |
| `domain/constants.ts` | 65 | Validation rules, limits |
| `domain/index.ts` | 48 | Barrel exports |

#### Services Layer (3 files, ~316 lines)
| File | Lines | Purpose |
|------|-------|---------|
| `services/account-service.interface.ts` | 99 | IAccountService contract |
| `services/account-service.ts` | 171 | Business logic implementation |
| `services/index.ts` | 46 | Factory + exports |

#### Repository Layer (5 files, ~1,493 lines)
| File | Lines | Purpose |
|------|-------|---------|
| `repository/account-repository.interface.ts` | 119 | IAccountRepository contract |
| `repository/supabase-account-repository.ts` | 450 | Remote Supabase operations |
| `repository/local-account-repository.ts` | 646 | WatermelonDB local-first storage |
| `repository/hybrid-account-repository.ts` | 183 | Orchestration layer |
| `repository/index.ts` | 95 | Factory functions |

#### Components Layer (7 files, ~745 lines)
| File | Lines | Purpose |
|------|-------|---------|
| `components/account-form.tsx` | 77 | Reusable form fields |
| `components/account-list.tsx` | 108 | Account list container |
| `components/account-list-item.tsx` | 123 | Individual account row |
| `components/add-account-modal.tsx` | 239 | Create account modal |
| `components/edit-account-modal.tsx` | 223 | Edit account modal |
| `components/delete-account-dialog.tsx` | 56 | Delete confirmation |
| `components/currency-manager.tsx` | 119 | Multi-currency selector |

#### Hooks Layer (3 files, ~470 lines)
| File | Lines | Purpose |
|------|-------|---------|
| `hooks/use-account-service.ts` | 74 | Service DI hook |
| `hooks/use-accounts.ts` | 133 | React Query data fetching |
| `hooks/use-account-mutations.ts` | 263 | Create/Update/Delete mutations |

#### Schemas & Exports (2 files, ~59 lines)
| File | Lines | Purpose |
|------|-------|---------|
| `schemas/account.schema.ts` | 26 | Zod form validation |
| `index.ts` | 33 | Feature barrel export |

---

### 1.2 Entity Registry - Complete Type Definitions

#### Core Entities (from `@/domain/accounts`, re-exported via `domain/entities.ts`)

| Entity | Description |
|--------|-------------|
| `AccountType` | Union: `'checking' \| 'savings' \| 'credit_card' \| 'investment' \| 'loan' \| 'cash' \| 'other'` |
| `AccountEntity` | Core account interface (readonly properties) |
| `AccountViewEntity` | Extends AccountEntity with `currencySymbol` |
| `isAccountViewEntity()` | Type guard for view entity |
| `isDeletedAccount()` | Type guard for soft-deleted accounts |

**AccountEntity Interface Fields:**
```typescript
interface AccountEntity {
  readonly id: string;                    // UUID primary key
  readonly version: number;               // Optimistic concurrency control
  readonly userId: string;                // FK to users table
  readonly groupId: string;               // Multi-currency account grouping
  readonly name: string;                  // Display name
  readonly type: AccountType;             // Account category
  readonly currencyCode: string;          // ISO 4217 code
  readonly color: string;                 // Hex color (#RRGGBB)
  readonly currentBalanceCents: number;   // INTEGER CENTS (Sacred Mandate)
  readonly isVisible: boolean;            // UI visibility flag
  readonly createdAt: string;             // ISO 8601 timestamp
  readonly updatedAt: string;             // ISO 8601 timestamp
  readonly deletedAt: string | null;      // Tombstone (null = active)
}
```

#### DTOs (`domain/types.ts`)

| DTO | Lines | Fields | Purpose |
|-----|-------|--------|---------|
| `AccountDataResult<T>` | 22 | Generic | Result wrapper: `SharedDataResult<T, AccountError>` |
| `CreateAccountDTO` | 40-60 | `id?`, `name`, `type`, `color`, `currencies` | Account group creation input |
| `UpdateAccountDTO` | 77-89 | `name?`, `color?`, `isVisible?`, `version` | Partial update with required version |
| `CreateAccountGroupResult` | 104-110 | `groupId`, `accounts` | Creation response |
| `AccountFilters` | 117-129 | `type?`, `isVisible?`, `groupId?`, `includeDeleted?` | Query filters |

#### Error Classes (`domain/errors.ts`)

| Error Class | Code | Lines | Fields |
|-------------|------|-------|--------|
| `AccountError` | Base | 34-40 | `code: string` |
| `AccountLockedError` | `ACCOUNT_LOCKED` | 76-90 | `accountId`, `reason` |
| `AccountNotFoundError` | `ACCOUNT_NOT_FOUND` | 98-101 | `accountId` |
| `AccountVersionConflictError` | `VERSION_CONFLICT` | 109-118 | `accountId`, `expectedVersion` |
| `AccountValidationError` | `VALIDATION_ERROR` | 126-132 | `field?` |
| `AccountRepositoryError` | `REPOSITORY_ERROR` | 140-146 | `originalError?: unknown` |
| `AccountDuplicateNameError` | `DUPLICATE_NAME` | 154-163 | `accountName`, `currencyCode` |

**Type Guards (Lines 169-209):**
- `isAccountNotFoundError(error: unknown)` - Line 169
- `isVersionConflictError(error: unknown)` - Line 178
- `isValidationError(error: unknown)` - Line 187
- `isDuplicateNameError(error: unknown)` - Line 196
- `isAccountLockedError(error: unknown)` - Line 205

#### Service & Repository Interfaces

**IAccountService** (`services/account-service.interface.ts:36-99`):
| Method | Line | Signature |
|--------|------|-----------|
| `getAll` | 44 | `(filters?: AccountFilters) => Promise<AccountViewEntity[]>` |
| `getById` | 54 | `(id: string) => Promise<AccountViewEntity>` |
| `getByGroupId` | 63 | `(groupId: string) => Promise<AccountViewEntity[]>` |
| `create` | 73 | `(data: CreateAccountDTO) => Promise<CreateAccountGroupResult>` |
| `update` | 85 | `(id: string, data: UpdateAccountDTO) => Promise<AccountViewEntity>` |
| `delete` | 98 | `(id: string, version: number) => Promise<void>` |

**IAccountRepository** (`repository/account-repository.interface.ts:38-119`):
| Method | Line | Signature |
|--------|------|-----------|
| `getAll` | 46 | `(userId, filters?) => Promise<AccountDataResult<AccountViewEntity[]>>` |
| `getById` | 58 | `(userId, id) => Promise<AccountDataResult<AccountViewEntity>>` |
| `getByGroupId` | 70 | `(userId, groupId) => Promise<AccountDataResult<AccountViewEntity[]>>` |
| `createWithCurrencies` | 84 | `(userId, data) => Promise<AccountDataResult<CreateAccountGroupResult>>` |
| `update` | 97 | `(userId, id, data) => Promise<AccountDataResult<AccountViewEntity>>` |
| `delete` | 114 | `(userId, id, version) => Promise<AccountDataResult<void>>` |

#### Component Props

**AccountFormProps** (`components/account-form.tsx:24-30`):
```typescript
interface AccountFormProps {
  register: UseFormRegister<AccountFormData>;
  errors: FieldErrors<AccountFormData>;
  setValue: UseFormSetValue<AccountFormData>;
  control: Control<AccountFormData>;
  isSubmitting: boolean;
}
```

#### Constants (`domain/constants.ts`)

| Constant | Lines | Values |
|----------|-------|--------|
| `ACCOUNT_VALIDATION` | 22-37 | `NAME_MAX_LENGTH: 100`, `NAME_MIN_LENGTH: 1`, `COLOR_REGEX`, `MAX_CURRENCIES_PER_GROUP: 10`, `DEFAULT_COLOR` |
| `ACCOUNT_ERRORS` | 42-54 | Error message templates |
| `ACCOUNT_LIMITS` | 59-65 | `MAX_ACCOUNTS_PER_USER: 100`, `DEFAULT_PAGE_SIZE: 50` |

---

### 1.3 Naming Convention Audit

**Status: COMPLIANT**

#### Domain Objects - camelCase Verification

All 35+ property names verified camelCase compliant:

```
CreateAccountDTO:     id, name, type, color, currencies
UpdateAccountDTO:     name, color, isVisible, version
CreateAccountGroupResult: groupId, accounts
AccountFilters:       type, isVisible, groupId, includeDeleted
Error properties:     accountId, expectedVersion, currencyCode, accountName, reason
Service methods:      getAll, getById, getByGroupId, createWithCurrencies
```

#### Database Queries - snake_case Verification

**Supabase Repository** (`supabase-account-repository.ts`):
| Line | Query | Status |
|------|-------|--------|
| 64 | `.eq('user_id', userId)` | PASS |
| 69 | `.eq('type', filters.type)` | PASS |
| 72 | `.eq('is_visible', filters.isVisible)` | PASS |
| 75 | `.eq('group_id', filters.groupId)` | PASS |
| 80 | `.is('deleted_at', null)` | PASS |
| 128 | `.eq('user_id', userId)` | PASS |
| 129 | `.is('deleted_at', null)` | PASS |
| 192-198 | RPC: `p_user_id`, `p_name`, `p_color`, `p_type`, `p_currencies` | PASS |
| 262-267 | RPC: `p_account_id`, `p_expected_version`, `p_name`, `p_color`, `p_is_visible` | PASS |

**Local Repository** (`local-account-repository.ts`):
| Line | Query/Assignment | Status |
|------|-----------------|--------|
| 104 | `Q.where('type', filters.type)` | PASS |
| 108 | `Q.where('is_visible', filters.isVisible)` | PASS |
| 112 | `Q.where('group_id', filters.groupId)` | PASS |
| 134 | `Q.where('user_id', userId)` | PASS |

**Transformation Flow:**
```
Supabase (snake_case) → validateOrThrow() → dbAccountViewToDomain() → Domain (camelCase)
WatermelonDB → localAccountViewsToDomain() → Domain (camelCase)
```

---

### 1.4 Type Safety Audit

**Status: COMPLIANT**

#### Dangerous Pattern Search Results

| Pattern | Occurrences | Status |
|---------|-------------|--------|
| `as any` | 0 | PASS |
| `// @ts-ignore` | 0 | PASS |
| `// @ts-expect-error` | 0 | PASS |
| Untyped `any` parameters | 0 | PASS |

#### Justified `unknown` Usage

**Error Type Guards** (`domain/errors.ts:170, 179, 188, 197, 206`):
```typescript
export function isAccountNotFoundError(
  error: unknown  // Correct: unknown input for type narrowing
): error is AccountNotFoundError {
  return error instanceof AccountNotFoundError;  // Safe instanceof check
}
```

**Error Envelope** (`domain/errors.ts:143`):
```typescript
public readonly originalError?: unknown  // Correct: wraps arbitrary errors from catch blocks
```

#### Justified Type Assertions

**`as Error` in catch blocks** (13 occurrences across repositories):
- All assertions are in catch block error handlers
- Immediately followed by `.message` property access
- Standard TypeScript error handling pattern

**Supabase Repository Examples:**
| Line | Pattern | Justification |
|------|---------|---------------|
| 107 | `(err as Error).message` | Catch block, safe message extraction |
| 159 | `(err as Error).message` | Catch block, safe message extraction |
| 245 | `(err as Error).message` | Catch block, safe message extraction |

**RPC Response Casts** (lines 214, 282, 391):
- All RPC responses validated with Zod schema first
- Assertions cast to known response shapes
- Properties accessed with optional chaining

#### Zod Validation Chain

**Repository Layer** (`supabase-account-repository.ts`):
```typescript
// Line 96: Batch validation
const validated = validateArrayOrThrow(BankAccountViewRowSchema, data ?? [], 'BankAccountViewRow');

// Line 150: Single record validation
const validated = validateOrThrow(BankAccountViewRowSchema, data, 'BankAccountViewRow');
```

**Form Layer** (`schemas/account.schema.ts`):
```typescript
export const createAccountSchema = z.object({
  name: z.string()
    .min(VALIDATION.MIN_LENGTH.REQUIRED, ACCOUNTS.MESSAGES.ERROR.VALIDATION_NAME_REQUIRED)
    .max(UI.MAX_LENGTH.ACCOUNT_NAME, ACCOUNTS.MESSAGES.ERROR.VALIDATION_NAME_TOO_LONG),
  color: z.string()
    .regex(ACCOUNT.COLOR_REGEX, ACCOUNTS.MESSAGES.ERROR.VALIDATION_COLOR_INVALID),
});
```

---

## 2. Dependency Manifest (Import Audit)

### 2.1 Feature Bleed Check

**Status: VIOLATION - 1 issue found**

#### Violation #1 - Cross-Feature Import
| Attribute | Value |
|-----------|-------|
| **File** | `components/add-account-modal.tsx` |
| **Line** | 7 |
| **Import** | `import { useCurrencies } from '@/features/currencies/hooks/use-currencies';` |
| **Usage** | Line 41: `const { data: currencies = [] } = useCurrencies();` |
| **Severity** | CRITICAL |
| **Impact** | Creates tight coupling between `accounts` and `currencies` features |

**Recommendation**: Extract `useCurrencies` to `@/lib/hooks/use-currencies` as a shared hook.

### 2.2 Import Statistics by Category

| Source | Count | Status |
|--------|-------|--------|
| `@/features/accounts/*` (internal) | 6 | VALID |
| `@/features/currencies/*` (external) | 1 | **VIOLATION** |
| `@/lib/*` | 35+ | VALID |
| `@/components/ui/*` | 8 | VALID |
| `@/components/shared/*` | 3 | VALID |
| `@/types/*` | 2 | VALID |
| `@/domain/*` | 1 | VALID |
| External packages | ~15 | VALID |

### 2.3 File-by-File Import Audit

#### Components Layer

**account-form.tsx** - CLEAN
```
@/lib:         @/lib/constants
@/components:  @/components/ui/input, @/components/ui/label, @/components/shared/color-picker
External:      react-hook-form
```

**account-list-item.tsx** - CLEAN
```
@/lib:         @/lib/utils, @/lib/hooks/use-formatted-balance, @/lib/constants, @/lib/hooks/use-flat-accounts
@/components:  @/components/ui/dropdown-menu
External:      lucide-react
```

**account-list.tsx** - CLEAN
```
@/features:    ./account-list-item, ../components/add-account-modal (INTERNAL)
@/lib:         @/lib/hooks/use-flat-accounts, @/lib/hooks/use-account-navigation, @/lib/constants
@/components:  @/components/ui/button
External:      react, lucide-react
```

**add-account-modal.tsx** - **VIOLATION**
```
@/features:    @/features/currencies/hooks/use-currencies  <-- CROSS-FEATURE
@/lib:         @/lib/hooks/use-form-modal, @/lib/hooks/use-currency-manager, @/lib/constants, @/lib/utils
@/components:  @/components/ui/*
External:      react, react-hook-form, zod, lucide-react, @radix-ui/*
```

**edit-account-modal.tsx** - CLEAN
```
@/lib:         @/lib/hooks/use-form-modal, @/lib/constants, @/lib/utils
@/components:  @/components/shared/dashboard-modal, @/components/ui/*
Internal:      ../domain, ../hooks/use-account-mutations, ../schemas/account.schema
External:      react, react-hook-form, lucide-react
```

**delete-account-dialog.tsx** - CLEAN
```
@/lib:         @/lib/constants
@/components:  @/components/shared/delete-dialog
@/types:       @/types/domain
Internal:      ../hooks/use-account-mutations
External:      react
```

**currency-manager.tsx** - CLEAN
```
@/lib:         @/lib/hooks/use-currency-manager
@/components:  @/components/ui/popover
@/types:       @/types/domain
External:      react, lucide-react
```

#### Domain, Services, Repository, Hooks Layers - ALL CLEAN

All internal layers import only from:
- `@/lib/*` (shared utilities)
- `../` (same feature internal imports)
- External packages

### 2.4 Transformer Usage

**Status: COMPLIANT**

All database-to-domain transformations use shared transformers:

| Repository | File | Line | Transformer |
|------------|------|------|-------------|
| Supabase | `supabase-account-repository.ts` | 32, 98, 151 | `dbAccountViewToDomain` from `@/lib/data/data-transformers` |
| Local | `local-account-repository.ts` | 46, 94 | `localAccountViewsToDomain` from `@/lib/data/local-data-transformers` |

**No inline snake_case to camelCase conversions found.**

---

## 3. Sacred Mandate Compliance

### 3.1 Integer Cents

**Status: COMPLIANT**

#### Verification Points

| Location | Line | Code | Status |
|----------|------|------|--------|
| Local repo create | 264 | `record.currentBalanceCents = 0;` | Integer init |
| Local repo update | 628 | `record.currentBalanceCents = Math.round(balanceCents);` | Forced integer |
| Transformer | - | `currentBalanceCents: Math.round(model.currentBalanceCents)` | Guaranteed int |
| UI display | 28 | `formatCurrency(cents / 100, currencyCode)` | Display-only conversion |

#### Dangerous Pattern Search

| Pattern | Occurrences | Status |
|---------|-------------|--------|
| `parseFloat` on balance | 0 | PASS |
| `toFixed` on balance | 0 | PASS |
| Decimal arithmetic on balance | 0 | PASS |
| `*` or `/` on balance (except /100 for display) | 0 | PASS |

**Division by 100 only occurs in display functions, never in storage or calculations.**

### 3.2 Sync Integrity

**Status: COMPLIANT**

#### Version Field Requirements

| Operation | Requirement | Implementation |
|-----------|-------------|----------------|
| **Create** | Initialize version | `record.version = 1;` (local-repo:267) |
| **Update** | Require version in DTO | `UpdateAccountDTO.version: number` (types.ts:88) |
| **Update** | Check version match | `if (account.version !== data.version)` (local-repo:343) |
| **Update** | Server-side check | RPC `update_account_with_version` (supabase-repo:259-268) |
| **Delete** | Require version param | `delete(id, version)` (interface:117) |
| **Delete** | Check version match | `if (account.version !== version)` (local-repo:462) |
| **Delete** | Server-side check | RPC `delete_account_with_version` (supabase-repo:350-356) |

#### Component Integration

| Component | Line | Implementation |
|-----------|------|----------------|
| Edit modal | 147 | `version: account.version` passed to mutation |
| Delete dialog | 20-23 | `if (account?.version !== undefined)` guard |
| Delete dialog | 23 | `version: account.version` passed to mutation |

#### Version Conflict Handling

```typescript
// local-account-repository.ts:343-350
if (account.version !== data.version) {
  return {
    success: false,
    data: null,
    error: new AccountVersionConflictError(id, data.version),
    conflict: true,
  };
}
```

### 3.3 Soft Deletes (Tombstone Pattern)

**Status: COMPLIANT**

#### Implementation Evidence

**Delete Operation** (`local-account-repository.ts:486`):
```typescript
record.deletedAt = Date.now();  // Sets timestamp, does NOT delete
record.localSyncStatus = SYNC_STATUS.PENDING;
```

**Supabase RPC** (`supabase-account-repository.ts:350-351`):
```typescript
// Calls delete_account_with_version RPC (server implements soft delete)
```

#### Query Filtering

| Repository | Line | Filter |
|------------|------|--------|
| Supabase getAll | 80 | `query = query.is('deleted_at', null)` |
| Supabase getById | 129 | `.is('deleted_at', null)` |
| Local getAll | 135 | `activeTombstoneFilter()` (unless `includeDeleted`) |
| Local getById | 178 | `if (account.deletedAt !== null)` returns not found |

#### Hard Delete Search

| Pattern | Occurrences | Status |
|---------|-------------|--------|
| `.delete()` SQL calls | 0 | PASS |
| `DELETE FROM` queries | 0 | PASS |
| Physical row removal | 0 | PASS |

**All deletions use `deleted_at` timestamp exclusively.**

### 3.4 Auth Abstraction

**Status: COMPLIANT**

#### Interface Usage

**Service Constructor** (`account-service.ts:39`):
```typescript
constructor(
  private readonly repository: IAccountRepository,
  private readonly authProvider: IAuthProvider  // Injected abstraction
) {}
```

**Service Method** (`account-service.ts:48-49`):
```typescript
private async getCurrentUserId(): Promise<string> {
  return this.authProvider.getCurrentUserId();  // Uses interface
}
```

**Service Hook** (`use-account-service.ts:71`):
```typescript
const authProvider = createSupabaseAuthProvider(supabase);
return createAccountService(repository, authProvider);
```

#### Direct Supabase Auth Search

| Pattern | Occurrences | Status |
|---------|-------------|--------|
| `supabase.auth` in features/accounts | 0 | PASS |
| `getUser()` direct calls | 0 | PASS |
| `getSession()` direct calls | 0 | PASS |

**All auth access routes through IAuthProvider interface.**

---

## 4. Performance & Scalability

### 4.1 React Compiler Compatibility

**Status: COMPLIANT**

#### useWatch Usage Verification

| Component | Lines | Pattern |
|-----------|-------|---------|
| `account-form.tsx` | 39-43 | `useWatch({ control, name: 'color' })` |
| `add-account-modal.tsx` | 86-95 | `useWatch` for color and name fields |
| `edit-account-modal.tsx` | 66-75 | `useWatch` for color and name fields |

#### Deprecated Pattern Search

| Pattern | Occurrences | Status |
|---------|-------------|--------|
| `watch(` calls | 0 | PASS |
| Form subscriptions without `useWatch` | 0 | PASS |

### 4.2 Re-render Optimization

**Status: WARNING - 2 issues found**

#### Issue #1: Inline Array Creation
| Attribute | Value |
|-----------|-------|
| **File** | `components/account-list-item.tsx` |
| **Lines** | 40-52 |
| **Pattern** | `actions` array created on every render |
| **Impact** | New array reference triggers re-renders in child components |
| **Severity** | MEDIUM |

```typescript
// Lines 40-52: Created inline on every render
const actions = [
  {
    label: 'Edit',
    icon: Pencil,
    onClick: () => onEdit(account),
  },
  {
    label: 'Delete',
    icon: Trash2,
    onClick: () => onDelete(account),
    className: 'text-red-600',
  },
];
```

**Recommendation**: Wrap with `useMemo` or extract to module-level constant.

#### Issue #2: Missing useMemo for Filter Operation
| Attribute | Value |
|-----------|-------|
| **File** | `components/add-account-modal.tsx` |
| **Lines** | 106-108 |
| **Pattern** | O(n^2) filter operation on every render |
| **Impact** | Unnecessary computation with nested `some()` inside `filter()` |
| **Severity** | MEDIUM |

```typescript
// Lines 106-108: Recomputed on every render
const availableCurrencies = currencies.filter(
  (currency) => !selectedCurrencies.some((c) => c.currency_code === currency.code)
);
```

**Recommendation**: Wrap with `useMemo`:
```typescript
const availableCurrencies = useMemo(
  () => currencies.filter(
    (currency) => !selectedCurrencies.some((c) => c.currency_code === currency.code)
  ),
  [currencies, selectedCurrencies]
);
```

#### Properly Memoized Patterns

| Hook/Component | Lines | Pattern | Status |
|----------------|-------|---------|--------|
| `use-account-service.ts` | 58-74 | `useMemo` for service creation | CORRECT |
| `use-flat-accounts.ts` | 14-29 | `useMemo` for filtering/sorting | CORRECT |
| `use-account-navigation.ts` | 29-48 | `useCallback` for handlers | CORRECT |
| `use-currency-manager.ts` | 45-100 | `useMemo` + `useCallback` throughout | CORRECT |

### 4.3 useEffect Audit

**Status: COMPLIANT**

#### Single useEffect Found

**Location**: `components/edit-account-modal.tsx:78-85`

```typescript
useEffect(() => {
  if (account) {
    reset({
      name: account.name,
      color: account.color || ACCOUNT.DEFAULT_COLOR,
    });
  }
}, [account, reset]);
```

| Check | Status |
|-------|--------|
| Dependency array complete | PASS |
| `reset` is stable reference | PASS |
| No infinite loop risk | PASS |
| Purpose clear (form initialization) | PASS |

### 4.4 Query Optimization

**Status: COMPLIANT**

#### N+1 Query Prevention

**Batch Currency Fetch** (`local-account-repository.ts:74-95`):
```typescript
// Collect unique currency codes (O(n))
const currencyCodes = [...new Set(accounts.map((a) => a.currencyCode))];

// Single batch query (O(1) queries)
const currencies = await this.database
  .get<CurrencyModel>('global_currencies')
  .query(Q.where('code', Q.oneOf(currencyCodes)))
  .fetch();

// O(1) lookup map
const currencyMap = new Map(currencies.map((c) => [c.code, c]));
```

#### Query Key Structure

| Hook | Line | Query Key |
|------|------|-----------|
| `useAccounts()` | 60 | `QUERY_KEYS.ACCOUNTS` |
| `useAccount(id)` | 98 | `[...QUERY_KEYS.ACCOUNTS, id]` |
| `useAccountsByGroup(groupId)` | 124 | `[...QUERY_KEYS.ACCOUNTS, 'group', groupId]` |

#### Optimistic Updates

**useUpdateAccount** (`use-account-mutations.ts:112-142`):
```typescript
onMutate: async ({ id, data }) => {
  await queryClient.cancelQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
  const previousAccounts = queryClient.getQueryData<AccountViewEntity[]>(QUERY_KEYS.ACCOUNTS);
  if (previousAccounts) {
    queryClient.setQueryData<AccountViewEntity[]>(
      QUERY_KEYS.ACCOUNTS,
      previousAccounts.map((account) =>
        account.id === id ? { ...account, ...data, updatedAt: new Date().toISOString() } : account
      )
    );
  }
  return { previousAccounts };
},
```

**useDeleteAccount** (`use-account-mutations.ts:197-215`):
```typescript
onMutate: async ({ id }) => {
  // Cancel, snapshot, optimistically remove, return rollback data
},
onError: (err, variables, context) => {
  // Rollback on error
},
```

#### Cache Invalidation

**Batch Invalidation** (`use-account-mutations.ts:251-255`):
```typescript
onSettled: async () => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS }),
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRANSACTIONS.ALL }),
  ]);
},
```

#### Orchestrator Rule Compliance

| Hook | Line | Guard |
|------|------|-------|
| `useAccounts` | 67 | `enabled: !!service` |
| `useAccount` | 105 | `enabled: !!service && !!id` |
| `useAccountsByGroup` | 131 | `enabled: !!service && !!groupId` |

---

## 5. Architecture Compliance Summary

### 5.1 Layer Responsibilities

| Layer | Files | Responsibility |
|-------|-------|---------------|
| **Domain** | 5 | Entities, DTOs, errors, constants |
| **Repository** | 5 | Data access abstraction (Supabase + WatermelonDB) |
| **Service** | 3 | Business logic + auth context |
| **Hooks** | 3 | React Query integration + DI |
| **Components** | 7 | UI presentation |
| **Schemas** | 1 | Zod form validation |

### 5.2 CTO Mandates Checklist

| Mandate | Location | Status |
|---------|----------|--------|
| `currentBalanceCents`: INTEGER CENTS | `entities.ts`, `local-repo.ts:264,628` | PASS |
| `currencyCode`: Direct on entity | Entity interface | PASS |
| ISO 8601 date strings | `createdAt`, `updatedAt`, `deletedAt` | PASS |
| `DataResult<T>` pattern | All repository methods | PASS |
| `instanceof` error handling | `errors.ts:169-209`, `use-account-mutations.ts:226` | PASS |
| Tombstone soft deletes | `local-repo.ts:486`, `supabase-repo.ts:350` | PASS |
| No N+1 queries | `local-repo.ts:74-95` batch fetch | PASS |
| Orchestrator Rule | `use-account-service.ts:64`, all query `enabled` guards | PASS |
| Version-checked RPC | `supabase-repo.ts:259,350` | PASS |
| IAuthProvider abstraction | `account-service.ts:15,39` | PASS |
| React Compiler compatibility | All `useWatch` patterns | PASS |

### 5.3 Pattern Implementation

| Pattern | Implementation | Files |
|---------|----------------|-------|
| **Hybrid Repository** | Local-first with remote sync | `hybrid-account-repository.ts` |
| **DataResult Pattern** | `{ success, data, error }` | All repository methods |
| **Optimistic Concurrency** | Version field on all mutations | `UpdateAccountDTO`, RPCs |
| **Dependency Injection** | Service receives repository + auth | `account-service.ts` constructor |
| **Type Guards** | `instanceof` checks for error handling | `errors.ts`, `use-account-mutations.ts` |
| **Optimistic Updates** | Snapshot + rollback in mutations | `use-account-mutations.ts` |

---

## 6. Recommendations

### High Priority

| Issue | Location | Action |
|-------|----------|--------|
| Feature Bleed | `add-account-modal.tsx:7` | Extract `useCurrencies` to `@/lib/hooks/use-currencies` |
| Missing Memoization | `add-account-modal.tsx:106-108` | Wrap `availableCurrencies` in `useMemo` |
| Inline Array | `account-list-item.tsx:40-52` | Memoize `actions` array with `useMemo` |

### Low Priority

| Issue | Location | Action |
|-------|----------|--------|
| Consider extracting `CurrencyBalance` type | `use-currency-manager` | Move to `@/lib/types/domain` |

---

## Appendix A: Zod Schemas

### Form Validation (`schemas/account.schema.ts`)

```typescript
export const createAccountSchema = z.object({
  name: z.string()
    .min(VALIDATION.MIN_LENGTH.REQUIRED, ACCOUNTS.MESSAGES.ERROR.VALIDATION_NAME_REQUIRED)
    .max(UI.MAX_LENGTH.ACCOUNT_NAME, ACCOUNTS.MESSAGES.ERROR.VALIDATION_NAME_TOO_LONG),
  color: z.string()
    .regex(ACCOUNT.COLOR_REGEX, ACCOUNTS.MESSAGES.ERROR.VALIDATION_COLOR_INVALID),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export type CreateAccountFormData = z.infer<typeof createAccountSchema>;
export type UpdateAccountFormData = z.infer<typeof updateAccountSchema>;
```

### Database Row Validation (`lib/data/db-row-schemas.ts`)

```typescript
export const BankAccountRowSchema = z.object({
  id: uuid,
  group_id: uuid,
  user_id: uuid,
  name: z.string(),
  type: AccountTypeEnum,
  currency_code: z.string(),
  color: z.string(),
  is_visible: z.boolean(),
  current_balance: z.number(),
  created_at: timestamptz,
  updated_at: timestamptz,
  version: z.number().int().min(0).optional(),
  deleted_at: z.string().nullable().optional(),
});

export const BankAccountViewRowSchema = BankAccountRowSchema.extend({
  global_currencies: z.object({ symbol: z.string() }).nullable(),
});
```

---

## Appendix B: Audit Diff from Previous Version

| Category | Previous | Current | Change |
|----------|----------|---------|--------|
| Feature Bleed Violations | 2 | 1 | Improved (line 41 was duplicate of line 7) |
| Re-render Issues | 0 | 2 | NEW (more thorough audit) |
| Total Files | 25 | 25 | No change |
| Total LOC | ~3,752 | ~3,752 | No change |
| Sacred Mandates | All PASS | All PASS | No change |
| Type Safety | PASS | PASS | No change |

---

## Appendix C: File Reference Index

| File | Path |
|------|------|
| `entities.ts` | `features/accounts/domain/entities.ts` |
| `types.ts` | `features/accounts/domain/types.ts` |
| `errors.ts` | `features/accounts/domain/errors.ts` |
| `constants.ts` | `features/accounts/domain/constants.ts` |
| `account-service.interface.ts` | `features/accounts/services/account-service.interface.ts` |
| `account-service.ts` | `features/accounts/services/account-service.ts` |
| `account-repository.interface.ts` | `features/accounts/repository/account-repository.interface.ts` |
| `supabase-account-repository.ts` | `features/accounts/repository/supabase-account-repository.ts` |
| `local-account-repository.ts` | `features/accounts/repository/local-account-repository.ts` |
| `hybrid-account-repository.ts` | `features/accounts/repository/hybrid-account-repository.ts` |
| `use-account-service.ts` | `features/accounts/hooks/use-account-service.ts` |
| `use-accounts.ts` | `features/accounts/hooks/use-accounts.ts` |
| `use-account-mutations.ts` | `features/accounts/hooks/use-account-mutations.ts` |
| `account-form.tsx` | `features/accounts/components/account-form.tsx` |
| `account-list.tsx` | `features/accounts/components/account-list.tsx` |
| `account-list-item.tsx` | `features/accounts/components/account-list-item.tsx` |
| `add-account-modal.tsx` | `features/accounts/components/add-account-modal.tsx` |
| `edit-account-modal.tsx` | `features/accounts/components/edit-account-modal.tsx` |
| `delete-account-dialog.tsx` | `features/accounts/components/delete-account-dialog.tsx` |
| `currency-manager.tsx` | `features/accounts/components/currency-manager.tsx` |
| `account.schema.ts` | `features/accounts/schemas/account.schema.ts` |
