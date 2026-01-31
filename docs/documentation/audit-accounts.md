# Composable Manifest: features/accounts

> **Generated**: 2026-01-31
> **Auditor**: Senior Systems Architect & Security Auditor
> **Scope**: `/features/accounts/` folder
> **Revision**: 3.0 - Comprehensive line-by-line audit

---

## Executive Summary

| Category | Status | Notes |
|----------|--------|-------|
| Variable & Entity Registry | **PASS** | All entities properly typed with readonly properties |
| Naming Conventions | **PASS** | See clarification on AccountLockReason |
| Type Safety | **PASS** | Zero `any` usage, proper type guards |
| Dependency Manifest | **PASS** | Feature bleed FIXED |
| Transformer Usage | **PASS** | Uses shared transformers exclusively |
| Integer Cents | **PASS** | All balances as integers |
| Sync Integrity | **PASS** | Version checks on all mutations |
| Soft Deletes | **PASS** | Tombstone pattern verified |
| Auth Abstraction | **PASS** | IAuthProvider used throughout |
| React Compiler | **PASS** | useWatch used for all form subscriptions |
| Performance | **PASS** | Proper memoization patterns |

**Overall Grade: A**

---

## Clarification: AccountLockReason Naming

The previous audit flagged `'has_transactions'` and `'foreign_key'` in `AccountLockReason` as snake_case violations. **This is NOT a violation.**

**Analysis** (`domain/errors.ts:51`):
```typescript
export type AccountLockReason = 'reconciled' | 'has_transactions' | 'foreign_key';
```

These are **string literal enum values** that map directly to PostgreSQL SQLSTATE error codes:
- `'foreign_key'` maps to SQLSTATE `23503` (foreign_key_violation)
- `'reconciled'` maps to SQLSTATE `P0001` (raise_exception from Sacred Ledger triggers)
- `'has_transactions'` is a business logic check

**The naming convention rule applies to:**
- Interface/type PROPERTY NAMES (must be camelCase)
- Database COLUMN NAMES (must be snake_case)

**NOT to:**
- String literal values representing database error codes
- Enum-like type union values

The actual property name `reason` (line 79) IS camelCase. **COMPLIANT.**

---

## 1. Variable & Entity Registry

### 1.1 Feature File Inventory

**Total Files**: 25 | **Total Lines**: ~3,752

| Folder | Files | Lines | Purpose |
|--------|-------|-------|---------|
| `domain/` | 5 | ~469 | Entities, DTOs, errors, constants |
| `repository/` | 5 | ~1,493 | Data access layer |
| `services/` | 3 | ~316 | Business logic |
| `hooks/` | 3 | ~470 | React Query integration |
| `components/` | 7 | ~945 | UI components |
| `schemas/` | 1 | 26 | Zod validation |
| Root | 1 | 33 | Barrel exports |

### 1.2 Complete Entity Inventory

#### Domain Entities (re-exported from `@/domain/accounts`)

| Entity | Source | Description |
|--------|--------|-------------|
| `AccountType` | `@/domain/accounts` | `'checking' \| 'savings' \| 'credit_card' \| 'investment' \| 'loan' \| 'cash' \| 'other'` |
| `AccountEntity` | `@/domain/accounts` | Core account interface with readonly properties |
| `AccountViewEntity` | `@/domain/accounts` | Extends AccountEntity with `currencySymbol` |
| `isAccountViewEntity()` | `@/domain/accounts` | Type guard function |
| `isDeletedAccount()` | `@/domain/accounts` | Type guard for soft-deleted accounts |

#### DTOs (`domain/types.ts`)

| DTO | Lines | Readonly Properties |
|-----|-------|---------------------|
| `AccountDataResult<T>` | 22 | Generic result wrapper |
| `CreateAccountDTO` | 40-60 | `id?`, `name`, `type`, `color`, `currencies` |
| `UpdateAccountDTO` | 77-89 | `name?`, `color?`, `isVisible?`, `version` |
| `CreateAccountGroupResult` | 104-110 | `groupId`, `accounts` |
| `AccountFilters` | 117-129 | `type?`, `isVisible?`, `groupId?`, `includeDeleted?` |

#### Error Classes (`domain/errors.ts`)

| Class | Code | Lines | Properties |
|-------|------|-------|------------|
| `AccountError` | Base | 34-41 | `code: string` |
| `AccountLockedError` | `ACCOUNT_LOCKED` | 76-91 | `accountId`, `reason` |
| `AccountNotFoundError` | `ACCOUNT_NOT_FOUND` | 98-102 | `accountId` |
| `AccountVersionConflictError` | `VERSION_CONFLICT` | 109-119 | `accountId`, `expectedVersion` |
| `AccountValidationError` | `VALIDATION_ERROR` | 126-133 | `field?` |
| `AccountRepositoryError` | `REPOSITORY_ERROR` | 140-147 | `originalError?: unknown` |
| `AccountDuplicateNameError` | `DUPLICATE_NAME` | 154-164 | `accountName`, `currencyCode` |

#### Type Guards (`domain/errors.ts`)

| Function | Line | Pattern |
|----------|------|---------|
| `isAccountNotFoundError()` | 169-173 | `error instanceof AccountNotFoundError` |
| `isVersionConflictError()` | 178-182 | `error instanceof AccountVersionConflictError` |
| `isValidationError()` | 187-191 | `error instanceof AccountValidationError` |
| `isDuplicateNameError()` | 196-200 | `error instanceof AccountDuplicateNameError` |
| `isAccountLockedError()` | 205-209 | `error instanceof AccountLockedError` |

#### Interfaces

| Interface | File | Lines | Methods |
|-----------|------|-------|---------|
| `IAccountRepository` | `repository/account-repository.interface.ts` | 38-119 | `getAll`, `getById`, `getByGroupId`, `createWithCurrencies`, `update`, `delete` |
| `IAccountService` | `services/account-service.interface.ts` | 36-99 | Same 6 methods (without userId param) |

#### Component Props

| Interface | File | Line |
|-----------|------|------|
| `AddAccountModalProps` | `add-account-modal.tsx` | 20-23 |
| `EditAccountModalProps` | `edit-account-modal.tsx` | 17-22 |
| `AccountListItemProps` | `account-list-item.tsx` | 15-21 |
| `DeleteAccountDialogProps` | `delete-account-dialog.tsx` | Inline |
| `CurrencyManagerProps` | `currency-manager.tsx` | Inline |
| `AccountFormProps` | `account-form.tsx` | 24-30 |

### 1.3 Naming Convention Verification

#### Property Names (camelCase) - VERIFIED

| File | Line | Properties |
|------|------|------------|
| `types.ts:40-60` | CreateAccountDTO | `id`, `name`, `type`, `color`, `currencies` |
| `types.ts:77-89` | UpdateAccountDTO | `name`, `color`, `isVisible`, `version` |
| `types.ts:104-110` | CreateAccountGroupResult | `groupId`, `accounts` |
| `types.ts:117-129` | AccountFilters | `type`, `isVisible`, `groupId`, `includeDeleted` |
| `errors.ts:78-79` | AccountLockedError | `accountId`, `reason` |
| `errors.ts:111-112` | AccountVersionConflictError | `accountId`, `expectedVersion` |
| `errors.ts:156-157` | AccountDuplicateNameError | `accountName`, `currencyCode` |

#### Database Queries (snake_case) - VERIFIED

| File | Line | Query |
|------|------|-------|
| `local-account-repository.ts:104` | `Q.where('type', filters.type)` |
| `local-account-repository.ts:108` | `Q.where('is_visible', filters.isVisible)` |
| `local-account-repository.ts:112` | `Q.where('group_id', filters.groupId)` |
| `local-account-repository.ts:134` | `Q.where('user_id', userId)` |
| `local-account-repository.ts:257-261` | `record.userId`, `record.groupId`, `record.currencyCode` |

---

## 2. Dependency Manifest (Import Audit)

### 2.1 Feature Bleed Check

**Status: PASS - No violations**

#### Previous Violation (FIXED)

| File | Line | Previous Import | Current Import |
|------|------|-----------------|----------------|
| `add-account-modal.tsx` | 7 | `@/features/currencies/hooks/use-currencies` | `@/lib/hooks/use-currencies` |

#### All `@/features/` Imports Verified

```
features/accounts/services/index.ts:30-31    → Documentation comments only
features/accounts/components/account-list.tsx:6-8 → Internal (same feature)
features/accounts/repository/index.ts:47,84  → Documentation comments only
```

**All cross-feature imports are either:**
1. Documentation examples in comments
2. Internal imports within the same feature

### 2.2 Import Categories

| Source | Count | Status |
|--------|-------|--------|
| `@/lib/*` | 35+ | VALID |
| `@/components/ui/*` | 12 | VALID |
| `@/components/shared/*` | 2 | VALID |
| `@/domain/*` | 1 | VALID |
| `@/types/*` | 0 | N/A |
| `../` (internal) | 25+ | VALID |
| External packages | ~15 | VALID |

### 2.3 Transformer Usage

**Status: PASS**

| Repository | Line | Transformer | Source |
|------------|------|-------------|--------|
| `supabase-account-repository.ts` | 32 | `dbAccountViewToDomain` | `@/lib/data/data-transformers` |
| `local-account-repository.ts` | 46 | `localAccountViewsToDomain` | `@/lib/data/local-data-transformers` |

**No inline mapping logic found.**

---

## 3. Sacred Mandate Compliance

### 3.1 Integer Cents

**Status: PASS**

| Location | Line | Evidence |
|----------|------|----------|
| `local-account-repository.ts` | 264 | `record.currentBalanceCents = 0;` |
| `local-account-repository.ts` | 628 | `record.currentBalanceCents = Math.round(balanceCents);` |
| `account-list-item.tsx` | 28 | `formatCurrency(cents / 100, currencyCode)` (display only) |

**Dangerous patterns searched:**
- `parseFloat` on balance: 0 occurrences
- `toFixed` on balance: 0 occurrences
- Division not for display: 0 occurrences

### 3.2 Sync Integrity

**Status: PASS**

#### Version Initialization

| File | Line | Code |
|------|------|------|
| `local-account-repository.ts` | 267 | `record.version = 1;` |
| `local-account-repository.ts` | 269 | `record.localSyncStatus = getInitialSyncStatus(); // 'pending'` |

#### Version Checks

| Operation | File | Line | Check |
|-----------|------|------|-------|
| Update | `local-account-repository.ts` | 343 | `if (account.version !== data.version)` |
| Delete | `local-account-repository.ts` | 462 | `if (account.version !== version)` |

#### Mutation Lock Pattern

```typescript
// local-account-repository.ts:393-396
// MUTATION LOCK: Never increment version locally.
// Version only changes after successful server sync.
// This prevents Overwriting Race Conditions.
```

### 3.3 Soft Deletes (Tombstone Pattern)

**Status: PASS**

#### Implementation Evidence

```typescript
// local-account-repository.ts:483-489
// CTO MANDATE: Soft delete (Tombstone Pattern)
await this.database.write(async () => {
  await account.update((record) => {
    record.deletedAt = Date.now(); // Tombstone timestamp
    record.localSyncStatus = SYNC_STATUS.PENDING; // Mark for sync
  });
});
```

#### Query Filtering

| Repository | Line | Filter |
|------------|------|--------|
| `local-account-repository.ts` | 135 | `...activeTombstoneFilter()` |
| `local-account-repository.ts` | 178 | `if (account.deletedAt !== null)` |

**Hard delete search:**
- `.delete()` calls: 0
- `DELETE FROM`: 0
- Physical row removal: 0

### 3.4 Auth Abstraction

**Status: PASS**

#### Interface Usage

```typescript
// account-service.ts:15
import type { IAuthProvider } from '@/lib/auth/auth-provider.interface';

// account-service.ts:37-40
export class AccountService implements IAccountService {
  constructor(
    private readonly repository: IAccountRepository,
    private readonly authProvider: IAuthProvider  // Injected abstraction
  ) {}
```

#### Auth Method

```typescript
// account-service.ts:48-50
private async getCurrentUserId(): Promise<string> {
  return this.authProvider.getCurrentUserId();  // Via interface
}
```

#### Dependency Injection

```typescript
// use-account-service.ts:68-72
const supabase = createClient();
const repository = createHybridAccountRepository(supabase, database);
const authProvider = createSupabaseAuthProvider(supabase);
return createAccountService(repository, authProvider);
```

**Direct Supabase auth search:**
- `supabase.auth` in features/accounts: 0 occurrences

---

## 4. Performance & Scalability

### 4.1 React Compiler Compatibility

**Status: PASS**

#### useWatch Usage (All Form Subscriptions)

| Component | Lines | Fields |
|-----------|-------|--------|
| `add-account-modal.tsx` | 86-95 | `color`, `name` |
| `edit-account-modal.tsx` | 66-75 | `color`, `name` |

**Deprecated `watch()` usage: 0 occurrences**

### 4.2 Memoization Patterns

**Status: PASS**

#### Properly Memoized

| Hook | Line | Pattern |
|------|------|---------|
| `use-account-service.ts` | 61-73 | `useMemo(() => {...}, [database, isReady])` |

#### Optimistic Updates

| Hook | Lines | Pattern |
|------|-------|---------|
| `useUpdateAccount` | 112-142 | `onMutate` with snapshot + rollback |
| `useDeleteAccount` | 197-215 | `onMutate` with snapshot + rollback |

### 4.3 Query Optimization

#### N+1 Prevention

```typescript
// local-account-repository.ts:81-91
// Collect unique currency codes
const currencyCodes = [...new Set(accounts.map((a) => a.currencyCode))];

// Batch fetch currencies (CTO: No N+1)
const currencies = await this.database
  .get<CurrencyModel>('global_currencies')
  .query(Q.where('code', Q.oneOf(currencyCodes)))
  .fetch();

// Create lookup map for O(1) access
const currencyMap = new Map(currencies.map((c) => [c.code, c]));
```

#### Orchestrator Rule Compliance

| Hook | Line | Guard |
|------|------|-------|
| `useAccountService` | 64 | `if (!isReady) return null;` |
| `useCreateAccount` | 56 | `if (!service) throw new AccountRepositoryError(...)` |
| `useUpdateAccount` | 105 | `if (!service) throw new AccountRepositoryError(...)` |
| `useDeleteAccount` | 190 | `if (!service) throw new AccountRepositoryError(...)` |

---

## 5. Type Safety Deep Dive

### 5.1 Dangerous Pattern Search

| Pattern | Occurrences | Status |
|---------|-------------|--------|
| `as any` | 0 | PASS |
| `// @ts-ignore` | 0 | PASS |
| `// @ts-expect-error` | 0 | PASS |
| Untyped function params | 0 | PASS |

### 5.2 Justified `unknown` Usage

| File | Line | Context | Justification |
|------|------|---------|---------------|
| `errors.ts` | 143 | `originalError?: unknown` | Wraps arbitrary errors from catch blocks |
| `errors.ts` | 170+ | Type guard params | Standard pattern for type narrowing |

### 5.3 Type Assertions

| File | Line | Pattern | Justification |
|------|------|---------|---------------|
| `local-account-repository.ts` | 153 | `(err as Error).message` | Catch block, safe message extraction |
| `use-account-mutations.ts` | 226 | `err instanceof AccountLockedError` | Proper type guard |

---

## 6. Architecture Compliance

### 6.1 Layer Responsibilities

```
┌─────────────────────────────────────────────────────────────┐
│                     Components Layer                         │
│  add-account-modal, edit-account-modal, account-list-item   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Hooks Layer                            │
│  useAccountService, useAccounts, useAccountMutations        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Service Layer                            │
│  AccountService (business logic + auth context)              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Repository Layer                          │
│  HybridAccountRepository → LocalAccountRepository            │
│                         → SupabaseAccountRepository (sync)   │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 CTO Mandates Checklist

| Mandate | Evidence | Status |
|---------|----------|--------|
| Integer Cents | `currentBalanceCents`, `Math.round()` | PASS |
| Sync Integrity | Version checks, `SYNC_STATUS.PENDING` | PASS |
| Soft Deletes | `record.deletedAt = Date.now()` | PASS |
| Auth Abstraction | `IAuthProvider` interface | PASS |
| No N+1 Queries | Batch currency fetch | PASS |
| Orchestrator Rule | `enabled: !!service` guards | PASS |
| React Compiler | `useWatch` throughout | PASS |
| instanceof Errors | Type guards, not string matching | PASS |
| DataResult Pattern | All repository methods | PASS |

---

## 7. File Reference Index

| File | Path | Lines |
|------|------|-------|
| `entities.ts` | `features/accounts/domain/entities.ts` | 18 |
| `types.ts` | `features/accounts/domain/types.ts` | 129 |
| `errors.ts` | `features/accounts/domain/errors.ts` | 209 |
| `constants.ts` | `features/accounts/domain/constants.ts` | 65 |
| `account-service.ts` | `features/accounts/services/account-service.ts` | 171 |
| `account-service.interface.ts` | `features/accounts/services/account-service.interface.ts` | 99 |
| `account-repository.interface.ts` | `features/accounts/repository/account-repository.interface.ts` | 119 |
| `supabase-account-repository.ts` | `features/accounts/repository/supabase-account-repository.ts` | 450 |
| `local-account-repository.ts` | `features/accounts/repository/local-account-repository.ts` | 646 |
| `hybrid-account-repository.ts` | `features/accounts/repository/hybrid-account-repository.ts` | 183 |
| `use-account-service.ts` | `features/accounts/hooks/use-account-service.ts` | 74 |
| `use-accounts.ts` | `features/accounts/hooks/use-accounts.ts` | 133 |
| `use-account-mutations.ts` | `features/accounts/hooks/use-account-mutations.ts` | 263 |
| `add-account-modal.tsx` | `features/accounts/components/add-account-modal.tsx` | 239 |
| `edit-account-modal.tsx` | `features/accounts/components/edit-account-modal.tsx` | 223 |
| `account-list-item.tsx` | `features/accounts/components/account-list-item.tsx` | 123 |
| `account-list.tsx` | `features/accounts/components/account-list.tsx` | 108 |
| `delete-account-dialog.tsx` | `features/accounts/components/delete-account-dialog.tsx` | 56 |
| `currency-manager.tsx` | `features/accounts/components/currency-manager.tsx` | 119 |
| `account-form.tsx` | `features/accounts/components/account-form.tsx` | 77 |
| `account.schema.ts` | `features/accounts/schemas/account.schema.ts` | 26 |

---

## 8. Audit History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-28 | Initial audit - 2 feature bleed violations |
| 2.0 | 2026-01-30 | Feature bleed reduced to 1, added performance warnings |
| 3.0 | 2026-01-31 | All violations resolved, clarified AccountLockReason naming |
