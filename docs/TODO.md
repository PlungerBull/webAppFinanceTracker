# Project Roadmap & Tasks

## Reliability & Go-Live Readiness

- [ ] **Import Optimization:** Fix timeouts on large Excel/CSV imports


---

## Phase 1: The Sacred Mandate (Critical/P0) ✅

**Goal:** Eliminate floating-point math and fix broken data paths.

- [x] **Repair the Broken Import RPC:** Update the `import_transactions` RPC in Supabase to reference `amount_cents` and `amount_home_cents` instead of the deleted `amount_original` columns. Ensure it converts decimal inputs to BIGINT using `ROUND(val * 100)`.
  - Migration: `20260130000000_fix_import_transactions_bigint.sql`

- [x] **Lock Down Settings Inputs:** Refactor `reconciliation-form-modal.tsx` to remove `step="0.01"` from number inputs. Implement a "Cents-at-the-Edge" pattern where user input is converted to integer cents via `toCents()` immediately upon form submission.

- [x] **Sanitize Dashboard Calculations:** Remove all `Math.round(val * 100) / 100` workarounds in `financial-overview.tsx`. Force the `get_monthly_spending_by_category` RPC to return BIGINT cents, ensuring the frontend only performs integer addition.

- [x] **Enforce Display Formatting:** Replace all instances of `.toFixed(2)` in `reconciliation-settings.tsx` and `inbox-card.tsx` with the centralized `formatCents()` utility to ensure consistent display logic.
  - Created `formatCents()` utility in `lib/utils/cents-conversion.ts`
  - Fixed critical bug: `reconciliation-settings.tsx` was displaying raw integer cents (e.g., 10050) instead of dollars ($100.50)


---

## Phase 2: Structural Decoupling (High/P1)

**Goal:** Resolve "Feature Bleed" to allow the iOS Native Port to compile features in isolation.

- [x] **Extract Shared Components:** Move the following from feature folders to `@/components/shared/`:
  - `TransactionDetailPanel` (from `features/shared`) → `components/shared/transaction-detail-panel/`
  - `CategorySelector` (from `features/transactions`) → `components/shared/category-selector.tsx`
  - `TransactionList` + `TransactionRow` (from `features/transactions`) → `components/shared/`

- [x] **Library Hook Migration:** Move `useBulkSelection` and `useCurrencies` hooks from feature folders to `@/lib/hooks/` to act as neutral orchestrators.

- [x] **Create Category IoC Interface:** Implemented `ICategoryOperations` interface in `@/domain/categories` (strategic rename from `IGroupingOperations`). Refactored `add-category-modal.tsx` and `edit-grouping-modal.tsx` to use local mutation hooks via the `useCategoryOperations()` orchestrator, eliminating cross-feature imports.

- [x] **Auth API Abstraction:** Move `authApi` from `features/auth/api/` to `lib/auth/` and ensure `ProfileSettings` utilizes the `IAuthProvider` interface for all metadata updates.
  - Moved auth API singleton to `lib/auth/auth-api.ts`
  - Removed deprecated legacy `authApi` object
  - Updated all 9 consumer files to use `getAuthApi()` from `@/lib/auth`


---

## Phase 3: Technical Hardening (Medium/P2)

**Goal:** Polish type safety and performance for S-Tier quality.

- [x] **Purge `any` and Fix Return Types:**
  - Replaced `undefined as any` in `local-transaction-repository.ts` and `supabase-transaction-repository.ts` with `undefined as void`
  - Fixed `currencyOriginal: undefined as any` in `data-transformers.ts` with empty string sentinel
  - [ ] Update `appearance-settings.tsx` to type the promise array as `Promise<void>[]` instead of `Promise<any>[]`

- [ ] **Memoization Cleanup:**
  - Wrap handlers in `inbox-card.tsx` (`handleAccountChange`, etc.) with `useCallback` to prevent re-renders in the infinite list.
  - Stabilize the `virtualizer` object in `transaction-list.tsx` by moving it to a `useRef` or providing a stable dependency key.

- [x] **Boundary Validation:** Added `GlobalCurrencyRowSchema` to `lib/data/db-row-schemas.ts` and applied Zod validation to `currenciesApi.getAll()`.


---

## Lint Cleanup (Tech Debt)

**Summary:** 173 issues (90 errors, 83 warnings) across 77 files

### Error Categories

| Type | Count | Severity |
|------|-------|----------|
| `@typescript-eslint/no-unused-vars` | 82 | warning |
| `@typescript-eslint/no-explicit-any` | 48 | error |
| `no-restricted-imports` (cross-feature) | 15 | error |
| `react-hooks/set-state-in-effect` | 11 | error |
| `react-compiler/react-compiler` (refs) | 6 | error |
| `prefer-const` | 5 | error |
| `react/no-unescaped-entities` | 4 | error |

### Hotspots by Directory

| Directory | Issues | Primary Problem |
|-----------|--------|-----------------|
| `features/transactions/` | 22 | Cross-feature imports, unused vars |
| `lib/sync/` | 14 | `any` types, unused vars |
| `lib/hooks/` | 11 | setState in effects |
| `features/settings/` | 7 | Cross-feature imports |
| `features/categories/` | 4 | Unused vars |
| `components/shared/` | 4 | setState in effects |

### Cross-Feature Import Violations (15 errors)

Files importing across feature boundaries (violates modular architecture):

- [ ] `features/settings/components/reconciliation-form-modal.tsx` → `@/features/reconciliations/`
- [ ] `features/settings/components/reconciliation-settings.tsx` → `@/features/reconciliations/`
- [ ] `features/transactions/components/all-transactions-table.tsx` → `@/features/categories/`, `@/features/accounts/`, `@/features/settings/`
- [ ] `features/transactions/components/bulk-action-bar.tsx` → `@/features/categories/`, `@/features/reconciliations/`
- [ ] `features/transactions/components/ledger-transaction-modal-content.tsx` → `@/features/categories/`, `@/features/accounts/`
- [ ] `features/transactions/components/transfer-form.tsx` → `@/features/accounts/`
- [ ] `features/transactions/domain/types.ts` → `@/features/inbox/`
- [ ] `features/transactions/hooks/use-direction-toggle.ts` → `@/features/categories/`
- [ ] `features/transactions/hooks/use-transfer-resolution.ts` → `@/features/accounts/`

**Fix Pattern:** Move shared hooks (`use-accounts`, `use-categories`, `use-reconciliations`) to `@/lib/hooks/` or create IoC interfaces in `@/domain/`.

### setState-in-Effect Anti-Pattern (11 errors)

Files with cascading render issues:

- [ ] `components/shared/transaction-detail-panel/index.tsx` (2 issues)
- [ ] `features/categories/components/edit-grouping-modal.tsx`
- [ ] `features/settings/components/appearance-settings.tsx` (3 issues)
- [ ] `features/transactions/components/all-transactions-table.tsx`
- [ ] `lib/hooks/use-category-selector.ts` (2 issues)
- [ ] `lib/hooks/use-inbox-detail-panel.ts`
- [ ] `lib/sync/hooks/use-initial-hydration.ts`

**Fix Pattern:** Derive state from props/context instead of syncing via useEffect, or use `useSyncExternalStore`.


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
