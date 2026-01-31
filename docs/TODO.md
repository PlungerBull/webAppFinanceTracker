# Project Roadmap & Tasks

## Reliability & Go-Live Readiness

- [ ] **Import Optimization:** Fix timeouts on large Excel/CSV imports



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
