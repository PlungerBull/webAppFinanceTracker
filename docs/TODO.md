# Project Roadmap & Tasks

## Reliability & Go-Live Readiness

- [ ] **Import Optimization:** Fix timeouts on large Excel/CSV imports


---

## Phase 1: The Sacred Mandate (Critical/P0)

**Goal:** Eliminate floating-point math and fix broken data paths.

- [ ] **Repair the Broken Import RPC:** Update the `import_transactions` RPC in Supabase to reference `amount_cents` and `amount_home_cents` instead of the deleted `amount_original` columns. Ensure it converts decimal inputs to BIGINT using `ROUND(val * 100)`.

- [ ] **Lock Down Settings Inputs:** Refactor `reconciliation-form-modal.tsx` to remove `step="0.01"` from number inputs. Implement a "Cents-at-the-Edge" pattern where user input is converted to integer cents via `toCents()` immediately upon form submission.

- [ ] **Sanitize Dashboard Calculations:** Remove all `Math.round(val * 100) / 100` workarounds in `financial-overview.tsx`. Force the `get_monthly_spending_by_category` RPC to return BIGINT cents, ensuring the frontend only performs integer addition.

- [ ] **Enforce Display Formatting:** Replace all instances of `.toFixed(2)` in `reconciliation-settings.tsx` and `inbox-card.tsx` with the centralized `fromCents()` utility to ensure consistent display logic.


---

## Phase 2: Structural Decoupling (High/P1)

**Goal:** Resolve "Feature Bleed" to allow the iOS Native Port to compile features in isolation.

- [ ] **Extract Shared Components:** Move the following from feature folders to `@/components/shared/`:
  - `TransactionDetailPanel` (from `features/shared`)
  - `CategorySelector` (from `features/transactions`)
  - `TransactionList` (from `features/transactions`)

- [ ] **Library Hook Migration:** Move `useBulkSelection` and `useCurrencies` hooks from feature folders to `@/lib/hooks/` to act as neutral orchestrators.

- [ ] **Create Category IoC Interface:** Implement an `ICategoryOperations` interface in `@/domain/categories`. Refactor `add-category-modal.tsx` to depend on this interface rather than importing hooks directly from the groupings feature.

- [ ] **Auth API Abstraction:** Move `authApi` from `features/auth/api/` to `lib/auth/` and ensure `ProfileSettings` utilizes the `IAuthProvider` interface for all metadata updates.


---

## Phase 3: Technical Hardening (Medium/P2)

**Goal:** Polish type safety and performance for S-Tier quality.

- [ ] **Purge `any` and Fix Return Types:**
  - Replace `undefined as any` in `local-transaction-repository.ts` and `supabase-transaction-repository.ts` with explicit `DataResult<void>` return types.
  - Update `appearance-settings.tsx` to type the promise array as `Promise<void>[]` instead of `Promise<any>[]`.

- [ ] **Memoization Cleanup:**
  - Wrap handlers in `inbox-card.tsx` (`handleAccountChange`, etc.) with `useCallback` to prevent re-renders in the infinite list.
  - Stabilize the `virtualizer` object in `transaction-list.tsx` by moving it to a `useRef` or providing a stable dependency key.

- [ ] **Boundary Validation:** Add the missing `GlobalCurrencyRowSchema` to `lib/data/db-row-schemas.ts` and apply it to the `currenciesApi` to ensure reference data integrity.


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
