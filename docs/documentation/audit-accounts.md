# Composable Manifest: features/accounts

> **Generated**: 2026-01-28
> **Auditor**: Senior Systems Architect & Security Auditor
> **Scope**: `/features/accounts/` folder

---

## Executive Summary

| Category | Status | Issues |
|----------|--------|--------|
| Entity Registry | COMPLIANT | 0 |
| Naming Conventions | COMPLIANT | 0 |
| Type Safety | COMPLIANT | 0 |
| Dependency Manifest | **VIOLATION** | 2 |
| Integer Cents | COMPLIANT | 0 |
| Sync Integrity | COMPLIANT | 0 |
| Soft Deletes | COMPLIANT | 0 |
| Auth Abstraction | COMPLIANT | 0 |
| React Compiler | COMPLIANT | 0 |
| Re-render Optimization | COMPLIANT | 0 |

**Overall**: 2 violations found (Feature Bleed)

---

## 1. Variable & Entity Registry

### 1.1 Directory Structure

```
features/accounts/
├── components/                      (7 files)
│   ├── account-form.tsx
│   ├── account-list-item.tsx
│   ├── account-list.tsx
│   ├── add-account-modal.tsx
│   ├── currency-manager.tsx
│   ├── delete-account-dialog.tsx
│   └── edit-account-modal.tsx
├── domain/                          (5 files)
│   ├── entities.ts
│   ├── types.ts
│   ├── errors.ts
│   ├── constants.ts
│   └── index.ts
├── hooks/                           (3 files)
│   ├── use-account-mutations.ts
│   ├── use-account-service.ts
│   └── use-accounts.ts
├── repository/                      (5 files)
│   ├── account-repository.interface.ts
│   ├── hybrid-account-repository.ts
│   ├── supabase-account-repository.ts
│   ├── local-account-repository.ts
│   └── index.ts
├── services/                        (3 files)
│   ├── account-service.interface.ts
│   ├── account-service.ts
│   └── index.ts
├── schemas/                         (1 file)
│   └── account.schema.ts
└── index.ts
```

**Total: 25 TypeScript/TSX files**

### 1.2 Entity Inventory

#### Entities (`domain/entities.ts`)

| Entity | Lines | Description |
|--------|-------|-------------|
| `AccountType` | 17-24 | Type union: `'checking' \| 'savings' \| 'credit_card' \| 'investment' \| 'loan' \| 'cash' \| 'other'` |
| `AccountEntity` | 51-97 | Core account interface with readonly properties |
| `AccountViewEntity` | 113-116 | Extends AccountEntity with `currencySymbol` |

**AccountEntity Fields:**
```typescript
interface AccountEntity {
  readonly id: string;                    // UUID
  readonly version: number;               // Optimistic concurrency
  readonly userId: string;                // FK to users
  readonly groupId: string;               // Multi-currency grouping
  readonly name: string;
  readonly type: AccountType;
  readonly currencyCode: string;
  readonly color: string;
  readonly currentBalanceCents: number;   // INTEGER CENTS
  readonly isVisible: boolean;
  readonly createdAt: string;             // ISO 8601
  readonly updatedAt: string;             // ISO 8601
  readonly deletedAt: string | null;      // Tombstone
}
```

#### DTOs (`domain/types.ts`)

| DTO | Lines | Purpose |
|-----|-------|---------|
| `AccountDataResult<T>` | 22 | Generic result wrapper using `SharedDataResult<T, AccountError>` |
| `CreateAccountDTO` | 40-60 | Input for creating account group with currencies |
| `UpdateAccountDTO` | 77-89 | Partial update fields + version |
| `CreateAccountGroupResult` | 104-110 | Response: groupId + accounts array |
| `AccountFilters` | 117-129 | Query filters: type, isVisible, groupId, includeDeleted |

#### Interfaces

| Interface | File | Lines | Purpose |
|-----------|------|-------|---------|
| `IAccountRepository` | `repository/account-repository.interface.ts` | 38-119 | Data access contract (6 methods) |
| `IAccountService` | `services/account-service.interface.ts` | 36-99 | Business logic contract |

#### Error Classes (`domain/errors.ts`)

| Error | Code | Purpose |
|-------|------|---------|
| `AccountError` | Base | Parent class |
| `AccountLockedError` | `ACCOUNT_LOCKED` | Cannot delete (reconciled/has transactions/FK) |
| `AccountNotFoundError` | `ACCOUNT_NOT_FOUND` | Account ID not found |
| `AccountVersionConflictError` | `VERSION_CONFLICT` | Optimistic concurrency failure |
| `AccountValidationError` | `VALIDATION_ERROR` | Data validation failure |
| `AccountRepositoryError` | `REPOSITORY_ERROR` | Database operation failure |
| `AccountDuplicateNameError` | `DUPLICATE_NAME` | Duplicate name+currency |

**Type Guards Provided:**
- `isAccountNotFoundError()` - Line 169
- `isVersionConflictError()` - Line 178
- `isValidationError()` - Line 187
- `isDuplicateNameError()` - Line 196
- `isAccountLockedError()` - Line 205

### 1.3 Naming Audit

**Status: COMPLIANT**

| Context | Convention | Example |
|---------|------------|---------|
| Domain Objects | camelCase | `currentBalanceCents`, `groupId`, `isVisible` |
| Database Rows | snake_case | `current_balance`, `group_id`, `is_visible` |

**Transformation Function:**
`dbAccountViewToDomain()` at `lib/data/data-transformers.ts:278-302` handles snake_case → camelCase conversion.

### 1.4 Type Safety Audit

**Status: COMPLIANT**

| Check | Result |
|-------|--------|
| `as any` usage | **0 instances** |
| `as unknown` usage | Proper - only in error type guards |
| Naked types | None found |
| Zod validation | Implemented at boundaries |

**Validation Chain:**
1. Supabase returns data
2. `validateArrayOrThrow(BankAccountViewRowSchema, data)` validates
3. `dbAccountViewToDomain()` transforms to domain entity

---

## 2. Dependency Manifest (Import Audit)

### 2.1 Feature Bleed Check

**Status: VIOLATION - 2 issues found**

#### Violation #1
- **File**: `components/add-account-modal.tsx`
- **Line**: 7
- **Import**: `import { useCurrencies } from '@/features/currencies/hooks/use-currencies';`
- **Severity**: CRITICAL

#### Violation #2
- **File**: `components/add-account-modal.tsx`
- **Line**: 41
- **Usage**: `const { data: currencies = [] } = useCurrencies();`
- **Context**: Fetches currencies for CurrencyManager component

**Recommendation**: Extract `useCurrencies` to `@/lib/hooks/use-currencies` to break the feature dependency.

### 2.2 Valid Import Sources

| Source | Count | Status |
|--------|-------|--------|
| `@/lib/*` | 50+ | VALID |
| `@/components/shared/*` | 3 | VALID |
| `@/components/ui/*` | 10+ | VALID |
| Internal (same feature) | 20+ | VALID |
| External packages | Standard | VALID |

### 2.3 Transformer Usage

**Status: COMPLIANT**

All database transformations use shared transformers:

| Repository | Transformer | Location |
|------------|-------------|----------|
| `supabase-account-repository.ts` | `dbAccountViewToDomain` | `@/lib/data/data-transformers` |
| `local-account-repository.ts` | `localAccountViewsToDomain` | `@/lib/data/local-data-transformers` |

**No inline mapping logic found.**

### 2.4 Direct Supabase Imports

**Status: ACCEPTABLE**

Supabase imports only in repository layer (correct location):
- `repository/supabase-account-repository.ts:14` - Type import
- `repository/index.ts:14` - Factory pattern

**No violations**: Components, hooks, and services do not import Supabase directly.

---

## 3. Sacred Mandate Compliance

### 3.1 Integer Cents

**Status: COMPLIANT**

**Entity Definition** (`domain/entities.ts:77-84`):
```typescript
/**
 * Current balance in INTEGER CENTS
 *
 * SACRED INTEGER ARITHMETIC (CTO Mandate):
 * - $10.50 = 1050 (NOT 10.5)
 * - $0.01 = 1
 * - $100.00 = 10000
 */
readonly currentBalanceCents: number;
```

**Evidence:**
- New accounts initialize with `currentBalanceCents = 0` (line 264, local-repo)
- Balance updates use `Math.round(balanceCents)` (line 627, local-repo)
- UI converts only at display: `cents / 100` (line 28, account-list-item)
- `toCents()` / `fromCents()` used in transformers

### 3.2 Sync Integrity

**Status: COMPLIANT**

**Version Initialization** (`local-account-repository.ts:267-269`):
```typescript
record.version = 1;
record.deletedAt = null;
record.localSyncStatus = getInitialSyncStatus(); // 'pending'
```

**Version-Checked Operations:**
- Update RPC: `update_account_with_version` (supabase-repo:259-268)
- Delete RPC: `delete_account_with_version` (supabase-repo:350-356)
- Version conflict detection with `AccountVersionConflictError`

**Mutation Lock Pattern:**
```typescript
// MUTATION LOCK: Never increment version locally.
// Version only changes after successful server sync.
// This prevents Overwriting Race Conditions.
```

### 3.3 Soft Deletes (Tombstone Pattern)

**Status: COMPLIANT**

**Implementation** (`local-account-repository.ts:483-489`):
```typescript
// CTO MANDATE: Soft delete (Tombstone Pattern)
await this.database.write(async () => {
  await account.update((record) => {
    record.deletedAt = Date.now();
    record.localSyncStatus = SYNC_STATUS.PENDING;
  });
});
```

**Query Filtering:**
- `query.is('deleted_at', null)` in Supabase queries
- `activeTombstoneFilter()` in WatermelonDB queries
- `includeDeleted` filter option available

**No physical DELETE operations found.**

### 3.4 Auth Abstraction

**Status: COMPLIANT**

**Service Layer** (`services/account-service.ts:15,39`):
```typescript
import type { IAuthProvider } from '@/lib/auth/auth-provider.interface';

export class AccountService implements IAccountService {
  constructor(
    private readonly repository: IAccountRepository,
    private readonly authProvider: IAuthProvider  // Abstraction
  ) {}

  private async getCurrentUserId(): Promise<string> {
    return this.authProvider.getCurrentUserId();  // Via interface
  }
}
```

**Dependency Injection** (`hooks/use-account-service.ts:68-72`):
```typescript
const authProvider = createSupabaseAuthProvider(supabase);
return createAccountService(repository, authProvider);
```

**No direct `supabase.auth.getUser()` calls in features/accounts.**

---

## 4. Performance & Scalability

### 4.1 React Compiler Check (useWatch)

**Status: COMPLIANT**

All form subscriptions use `useWatch` (React Compiler compatible):

| Component | Lines | Pattern |
|-----------|-------|---------|
| `account-form.tsx` | 39-43 | `useWatch({ control, name: 'color' })` |
| `add-account-modal.tsx` | 86-95 | `useWatch` for color and name |
| `edit-account-modal.tsx` | 66-75 | `useWatch` for color and name |

**No `watch()` calls found** (would be incompatible with React Compiler).

### 4.2 Re-render Optimization

**Status: COMPLIANT**

**Properly Memoized Service Creation** (`use-account-service.ts:58-74`):
```typescript
return useMemo(() => {
  if (!isReady) return null;
  const supabase = createClient();
  const repository = createHybridAccountRepository(supabase, database);
  const authProvider = createSupabaseAuthProvider(supabase);
  return createAccountService(repository, authProvider);
}, [database, isReady]);  // Correct dependencies
```

**Orchestrator Rule Compliance:**
- Service may be null until ready
- Queries use `enabled: !!service` guard
- No heavy computations in render path

### 4.3 N+1 Query Prevention

**Status: COMPLIANT**

**Batch Currency Fetch** (`local-account-repository.ts:74-95`):
```typescript
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

---

## 5. Architecture Compliance Summary

### Key Files and Responsibilities

| File | Responsibility |
|------|---------------|
| `domain/entities.ts` | Core account data structures |
| `domain/errors.ts` | Typed error classes with guards |
| `repository/account-repository.interface.ts` | Data access contract |
| `repository/supabase-account-repository.ts` | Remote database operations |
| `repository/local-account-repository.ts` | Local-first storage |
| `repository/hybrid-account-repository.ts` | Orchestration layer |
| `services/account-service.ts` | Business logic + auth context |
| `hooks/use-account-service.ts` | Service dependency injection |
| `hooks/use-accounts.ts` | React Query integration |
| `hooks/use-account-mutations.ts` | Optimistic mutations |

### CTO Mandates Checklist

| Mandate | Implementation | Status |
|---------|---------------|--------|
| `currentBalanceCents`: INTEGER CENTS | `entities.ts:84` | PASS |
| `currencyCode`: Direct on entity | `entities.ts:71` | PASS |
| ISO 8601 date strings | `entities.ts:89-96` | PASS |
| `DataResult<T>` pattern | `types.ts:22` | PASS |
| `instanceof` error handling | `errors.ts:169+` | PASS |
| Tombstone soft deletes | `supabase-repo.ts:349` | PASS |
| No N+1 queries | `local-repo.ts:74-94` | PASS |
| Orchestrator Rule | `use-account-service.ts:64` | PASS |
| Version-checked RPC | `supabase-repo.ts:259` | PASS |
| IAuthProvider abstraction | `account-service.ts:15` | PASS |

---

## 6. Recommendations

### High Priority

1. **Fix Feature Bleed Violation**
   - Extract `useCurrencies` hook to `@/lib/hooks/use-currencies`
   - Update import in `add-account-modal.tsx`

### Low Priority

2. **Consider extracting `CurrencyBalance` type**
   - Currently imported from `@/lib/hooks/use-currency-manager`
   - Could move to `@/lib/types/domain` for consistency

---

## Appendix: Zod Schemas

### Form Validation (`schemas/account.schema.ts`)

```typescript
export const createAccountSchema = z.object({
  name: z.string()
    .min(1, 'Account name is required')
    .max(100, 'Account name too long'),
  color: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});
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
