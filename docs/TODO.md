# Project Roadmap & Tasks

## Reliability & Go-Live Readiness

- [ ] **Import Optimization:** Fix timeouts on large Excel/CSV imports



---

## Lint Cleanup (Tech Debt)

**Summary:** 50 issues (0 errors, 50 warnings) — *Updated 2026-01-31*

✅ **All lint errors resolved.** Only intentional `_` prefix warnings remain.

### Current Status

| Type | Count | Severity | Status |
|------|-------|----------|--------|
| `@typescript-eslint/no-unused-vars` | 50 | warning | Intentional `_` prefixes |

### Completed Fixes (2026-01-31)

| Category | Count | Solution |
|----------|-------|----------|
| `@typescript-eslint/no-explicit-any` | 9 | Typed interfaces (`FilterableQuery`, `InfiniteQueryData<T>`), `as unknown as Type` for tests |
| `react/no-unescaped-entities` | 4 | Escaped `"` with `&quot;` in JSX |
| `react-hooks/preserve-manual-memoization` | 1 | Stabilized arrays via `useMemo` wrappers |
| `react-hooks/exhaustive-deps` | 1 | Wrapped `mergedConfig` in `useMemo`, added to deps |
| `no-restricted-imports` | 2 | Updated to use orchestrator layer (`@/lib/hooks/`) |

### Files Modified

- `features/reconciliations/components/settings/reconciliation-settings.tsx` — Escaped quotes
- `components/shared/transaction-detail-panel/form-section.tsx` — Import path fix
- `components/shared/transaction-detail-panel/identity-header.tsx` — Import path fix
- `lib/data/__tests__/data-transformers.test.ts` — `as unknown as Type` pattern
- `features/inbox/repository/supabase-inbox-repository.test.ts` — Typed mock
- `features/inbox/repository/local-inbox-repository.ts` — Removed unnecessary cast
- `features/transactions/api/filters.ts` — Added `FilterableQuery` interface
- `features/transactions/hooks/use-transaction-routing.ts` — Added `InfiniteQueryData<T>` interface
- `features/transactions/components/bulk-action-bar.tsx` — Stable array refs
- `lib/sync/hooks/use-delta-sync.ts` — `useMemo` for config object


---

## Known Bugs & Edge Cases

- [ ] **Build Error - Auth Import Boundary:** `lib/auth/index.ts` re-exports server-side code (`server-auth.ts`) which uses `next/headers`. This is imported by client components (`components/settings/change-email-modal.tsx`), violating the Next.js client/server boundary. Fix: Split exports into `lib/auth/client.ts` and `lib/auth/server.ts`, or use dynamic imports.
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
