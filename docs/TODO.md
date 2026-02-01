# Project Roadmap & Tasks

## Reliability & Go-Live Readiness

- [ ] **Import Optimization:** Fix timeouts on large Excel/CSV imports

---

## Architecture Audit (A- Grade)

> **Executive Verdict:** The "clean architecture" is largely intact. However, three systemic failures threaten integrity: the "Result Pattern" Schism, "Sync Schema" Drift, and "Cross-Feature" Leaks.

### Priority 1: Critical (Financial Safety & Crash Prevention)

- [x] **[TYPE-01] Global Result Pattern Standardization** ✅
  - Scope: `features/currencies`, `features/settings`, `features/reconciliations`
  - Task: Refactor all Service/API methods to catch try/catch blocks and return `{ success: true, data: T }` or `{ success: false, error: DomainError }`
  - Why: Prevents unhandled crashes in the Swift/Native bridge
  - **Completed:** S-Tier implementation with isOperational flag, originalError preservation, and typed DomainError classes

- [x] **[SYNC-01] Hardening the Sync Schema** ✅
  - Scope: Global (`types/supabase.ts`)
  - Task: Regenerate Supabase types to ensure `version` and `deleted_at` exist on all tables (specifically Accounts and Categories)
  - Why: The Delta Sync Engine will silently fail to sync deletions without these fields
  - **Completed:** S-Tier implementation:
    - Types already correct in `types/supabase.ts` (all syncable tables have `version` + `deleted_at`)
    - Deleted stale type files (`types/database.types.ts`, `lib/supabase/database.types.ts`)
    - Created `types/index.ts` for future-proof imports
    - Added `update_inbox_with_version()` and `dismiss_inbox_with_version()` RPCs (migration applied to DEV)
    - Supabase types regenerated via `supabase gen types typescript --linked`
    - Updated inbox repository to use version-checked RPCs for OCC
    - OCC Compliance: 100% on Accounts, Categories, Transactions, Inbox; Reconciliations has delete-only

- [x] **[ARCH-01] Break the Transaction/Grouping Cycle** ✅
  - Scope: `features/transactions/hooks/use-transaction-filters.ts`
  - Task: Extract `useGroupingChildren` logic into `@/lib/hooks`. Update both features to import from `@/lib`
  - Why: Breaks a circular dependency that threatens the bundler
  - **Completed:** S-Tier Inversion of Control implementation:
    - Created `lib/hooks/use-grouping-children.ts` using `useCategoryOperations` directly (service layer)
    - Added `GROUPING_CHILDREN` query key factory to `lib/constants/query.constants.ts`
    - Groupings feature now re-exports from `@/lib` (feature consumes library, not vice versa)
    - Transactions feature imports from `@/lib/hooks` (zero cross-feature imports)

### Priority 2: Optimization (Ghost Props & Cleanup)

- [ ] **[OPT-01] The "Ghost Prop" Audit Trail**
  - Scope: All Entities (`createdAt`, `updatedAt`, `userId`)
  - Task: Do not remove these properties. Instead, apply a standardized JSDoc annotation: `/** @internal Infrastructure field - Audit Trail */`
  - Why: Satisfies the "unused variable" linter while preserving data integrity for future features

- [ ] **[CLEAN-01] Settings "Spaghetti" Cleanup**
  - Scope: `features/settings/components/data-management.tsx`
  - Task: Extract the direct RPC call (`clear_user_data`) into a `DataManagementService`
  - Why: Enforces the Service Layer pattern in the weakest feature

- [ ] **[CLEAN-02] Inbox Ghost Props**
  - Scope: `InboxItemViewEntity`
  - Task: Deprecate `account` and `category` objects on the entity. They are expensive to serialize and never used in the UI

---

## Weakest Links (Scalability & Sync Bottlenecks)

### Weak Link #1: Settings (`features/settings`)
- **Risk: High** - Manages critical user state (Currency, Profile)
- Violates Result Pattern (throws errors), bypasses services to call RPCs directly, uses lazy imports to patch over dependency cycles

### Weak Link #2: Reconciliations (`features/reconciliations`)
- **Risk: Medium** - Financial integrity relies on reconciliations
- Throws errors instead of returning results, uses `any` in filters, has unused "Ghost Entity" (`ReconciliationWithAccount`)

### Weak Link #3: Transactions (`features/transactions`)
- **Risk: Low** - Cross-feature violation resolved ✅
- ~~`use-transaction-filters.ts` imports `useGroupingChildren` from `features/groupings`~~ Fixed via ARCH-01

---

## System-Wide Violations

### Cross-Feature Violations
- [x] **Transactions ➔ Groupings:** `use-transaction-filters.ts` imports `useGroupingChildren` from `features/groupings` ✅
  - Fix: Move shared logic to orchestrator hook in `@/lib/hooks/use-grouping-children.ts`
  - **Resolved:** S-Tier IoC - lib hook uses service layer directly, both features consume it
- [ ] **Import-Export ➔ Transactions:** `data-export-service.ts` imports `createTransactionRepository`
  - Status: Exception Granted (cross-cutting concern). Add explicit comments justifying the exception
- [ ] **Reconciliations Self-Reference:** `lib/hooks/use-bulk-selection.ts` imports from `features/reconciliations`
  - Fix: Remap the import to the `@/lib` orchestrator

### Type Inconsistencies
- [x] **The "Throw" Violation:** Refactor to return `DataResult<T>`: ✅
  - `currenciesApi.getAll()` ✅ Now returns DataResult
  - `UserSettingsService.getSettings()` ✅ Now returns DataResult
  - `useFinancialOverview` (Throws) - Dashboard scope, separate task
  - `ReconciliationsService` ✅ All 8 methods now return DataResult
- [x] **Schema Drift (Sync Critical):** ~~`database.types.ts` missing `version` and `deleted_at`~~ ✅
  - **Resolved:** `types/supabase.ts` has all sync fields. Stale `database.types.ts` deleted.

---

## Code Consistency Issues

### 1. Schema Definition Inconsistency
> **Rule:** Zod schemas should live in a dedicated `schemas/` folder (e.g., `features/auth/schemas`)

- [ ] **Groupings:** Move inline schemas from `add-grouping-form.tsx` and `add-subcategory-modal.tsx` to `features/groupings/schemas/`
- [ ] **Reconciliations:** Move inline schema from `reconciliation-form-modal.tsx` to `features/reconciliations/schemas/`
- Why: Makes validation logic harder to reuse and test in isolation

### 2. Deprecation "Zombie" Files
> **Rule:** If a file is deprecated, it should be removed or empty

- [ ] **Remove:** `features/auth/schemas/profile.schema.ts` - marked `@deprecated` but still exists as re-export wrapper
- [ ] **Remove:** `features/inbox/domain/entities.ts` - deprecated re-export wrapper
- [ ] **Fix:** `features/reconciliations/hooks/use-reconciliations.ts` - deprecated but still imported by `lib/hooks/use-bulk-selection.ts`
- Why: New developers might import from the "Zombie" file instead of the correct source

### 3. Ghost Prop Documentation
> **Rule:** Unused properties in entities must be documented

- [ ] **Dashboard:** Document `CategoryMonthlyData.isVirtualParent` - internal flag for transformer with no documentation explaining why it's unused in UI
- [ ] **Inbox:** Remove or document `InboxItemViewEntity.currencySymbol` - noted as "ALWAYS NULL" and forbidden, yet remains in type definition
- Why: Creates "noise" in the type system and makes iOS serialization payload heavier

### 4. Direct Logic Leak (Minor Spaghetti)
> **Rule:** Logic belongs in hooks/services, not components

- [ ] **Settings:** Extract `supabase.rpc('clear_user_data')` from `data-management.tsx` into a service
- [ ] **Settings:** Refactor `use-update-account-visibility.ts` to use a repository instead of direct `supabase.from(...).update(...)` call
- [ ] **Transactions:** Extract ~30 lines of reconciliation math from `bulk-action-bar.tsx` `useMemo` block into a service
- Why: These are "hard-to-test" pockets of logic that will be difficult to port to native mobile

### 5. Test Co-location Inconsistency
> **Rule:** Tests should be located consistently

- [ ] **Audit:** Transactions has visible `__tests__` folders co-located inside `hooks/` and `services/`
- [ ] **Standardize:** Other features do not show visible test folders - ensure consistent test placement or add missing tests
- Why: Inconsistent folder structures slow down developer navigation

### 6. Type Strictness Variance
> **Rule:** Zod schemas should match Domain types exactly

- [ ] **Settings:** Fix `transactionSortPreference` - Domain type is strict union `'date' | 'created_at'` but Zod schema validates as generic `z.string()` with type cast in transformer
- Why: Loses runtime validation for specific enum values

### 7. Folder Structure Schism
> **Rule:** Clean Architecture requires explicit layers: `repository/` (data access) and `services/` (business logic)

- [ ] **Reconciliations:** Split `api/reconciliations.ts` - currently acts as both Repository and Service
- [ ] **Settings:** Rename `api/user-settings.ts` to `services/user-settings.ts`
- [ ] **Transactions:** Audit `api/filters.ts` alongside existing `repository/` and `services/`
- Reference: Accounts & Categories follow the rule perfectly
- Why: Inconsistent naming makes navigation unpredictable. A developer looking for "business logic" in Settings won't find a `services` folder

### 8. Serialization Bloat (Mobile Performance)
> **Rule:** Entities should only carry data they actually use, especially for lists with hundreds of items

- [ ] **Inbox:** Remove nested `account` and `category` objects from `InboxItemViewEntity`
  - The UI (`inbox-card.tsx`) ignores these nested objects and fetches its own reference data via hooks (`useAccountsData`)
  - Currently double-fetching and serializing data
- Why: For the iOS bridge, passing thousands of redundant nested objects across the JSON boundary is a performance killer

### 9. Runtime Safety Gap
> **Rule:** Never trust the backend. Always validate RPC responses with Zod at the boundary

- [ ] **Dashboard:** Add Zod validation to `useFinancialOverview` - currently casts RPC response (`as MonthlySpendingDbRow[]`) instead of validating
- Why: If RPC response shape changes (e.g., `total_amount` becomes string), Dashboard will crash at runtime with obscure error rather than failing gracefully with validation message

### 10. Magic Number Leak
> **Rule:** Business constants belong in `@/lib/constants` or domain logic, not UI components

- [ ] **Transactions:** Extract `0.005` epsilon from `bulk-action-bar.tsx` (`Math.abs(previewDifference) < 0.005`) into central math utility
- Why: "0.005" is a magic number representing floating-point epsilon. This logic belongs in cents-conversion or math utility library for consistency

### 11. Dead Model Pollution
> **Rule:** If a type exists in the Domain, it must be used

- [ ] **Reconciliations:** Remove or utilize `ReconciliationWithAccount` interface - currently never used, code manually looks up accounts instead
- Why: Confuses new developers ("Should I be using this interface?") and adds noise to the codebase

---

## Known Bugs & Edge Cases

- [ ] **Main Currency Fix:** Resolve the bug where changing the "Main Currency" breaks existing balance calculations
- [ ] **Duplicate Detection:** Improve fuzzy matching logic in Inbox to reduce false negatives on duplicates
- [ ] **Import Edge Cases:** Better error handling for Excel files with malformed headers

---

## Future Roadmap

- [ ] **Budgeting Module:** Create database schema and UI for setting monthly category budgets
- [ ] **Net Wealth Tracker:** Dashboard to track assets (accounts, investments) vs liabilities over time
- [ ] **Expense Sharing:** Functionality to share expenses or split bills with other users
- [ ] **Recurring Transactions:** Engine to automatically generate transactions for subscriptions/rent
- [ ] **Investment Tracking:** Support for tracking stock units/prices in accounts
- [ ] **Multi-user Households:** Allow sharing accounts between two Auth users
- [ ] **AI Categorization:** Use LLM to suggest categories for Inbox items based on history
