# Project Roadmap & Tasks

## Reliability & Go-Live Readiness

- [ ] **Import Optimization:** Fix timeouts on large Excel/CSV imports

---

## Architecture Audit (A- Grade)

### Priority 2: Optimization (Ghost Props & Cleanup)

- [ ] **[CLEAN-02] Inbox Ghost Props**
  - Scope: `InboxItemViewEntity`
  - Task: Deprecate `account` and `category` objects on the entity. They are expensive to serialize and never used in the UI

---

## Weakest Links (Scalability & Sync Bottlenecks)

### Weak Link #2: Reconciliations (`features/reconciliations`) ✅
- **Risk: Medium** - Financial integrity relies on reconciliations
- ~~Throws errors instead of returning results~~ ✅ Fixed (TYPE-01 - Service uses DataResult pattern)
- ~~uses `any` in filters~~ ✅ False positive (`step="any"` is HTML attribute, not TypeScript)
- ~~has unused "Ghost Entity" (`ReconciliationWithAccount`)~~ ✅ Removed from domain

---

## System-Wide Violations

### Cross-Feature Violations
- [ ] **Import-Export ➔ Transactions:** `data-export-service.ts` imports `createTransactionRepository`
  - Status: Exception Granted (cross-cutting concern). Add explicit comments justifying the exception
- [x] **Reconciliations Self-Reference:** `lib/hooks/use-bulk-selection.ts` imports from `features/reconciliations` ✅
  - Fix: Remap the import to the `@/lib` orchestrator - **Done**

### Type Inconsistencies
- [ ] **The "Throw" Violation:** Refactor to return `DataResult<T>`:
  - `useFinancialOverview` (Throws) - Dashboard scope, separate task

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
- [x] **Fix:** `features/reconciliations/hooks/use-reconciliations.ts` - deprecated but still imported by `lib/hooks/use-bulk-selection.ts` ✅ **Deleted**
- Why: New developers might import from the "Zombie" file instead of the correct source

### 3. Ghost Prop Documentation
> **Rule:** Unused properties in entities must be documented

- [ ] **Dashboard:** Document `CategoryMonthlyData.isVirtualParent` - internal flag for transformer with no documentation explaining why it's unused in UI
- [ ] **Inbox:** Remove or document `InboxItemViewEntity.currencySymbol` - noted as "ALWAYS NULL" and forbidden, yet remains in type definition
- Why: Creates "noise" in the type system and makes iOS serialization payload heavier

### 4. Direct Logic Leak (Minor Spaghetti)
> **Rule:** Logic belongs in hooks/services, not components

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

- [x] **Reconciliations:** Remove or utilize `ReconciliationWithAccount` interface - currently never used, code manually looks up accounts instead ✅ **Removed**
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
