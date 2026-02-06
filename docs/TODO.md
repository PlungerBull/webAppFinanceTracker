# Project Roadmap & Tasks

## Reliability & Go-Live Readiness

- [ ] **Import Optimization:** Fix timeouts on large Excel/CSV imports
- [ ] **Transaction View Latency:** Optimize `transactions_view` in Supabase to handle larger datasets more efficiently

---

## Sync Hardening Backlog (Post S-Tier Sprint)

> **Context:** During the S-Tier Sync Infrastructure Hardening sprint (2026-02-02), these items were identified but intentionally deferred to maintain focus on core sync reliability.

### Technical Debt - Next Hardening Phase
- [ ] **E2E Conflict Resolution Tests:** Add Playwright tests simulating a user physically resolving a conflict via the Sync Conflict Modal UI
- [ ] **Conflict Count Sidebar Badge:** Add visual indicator in sidebar showing number of unresolved sync conflicts

---

## Code Consistency Issues

### 9. Legacy create_transfer NUMERIC Signatures
> **Technical Debt:** Old RPC signatures violate ADR 001 (Floating-Point Rejection)

- [ ] **Drop:** Legacy `create_transfer` overloads that use NUMERIC (dollars) instead of BIGINT (cents)
- **Location:** Two overloads in `current_live_snapshot.sql` lines 611-689 and 693+
- **Blocked By:** Verify S-Tier BIGINT overload works in production first
- **Migration:** Create `drop_legacy_create_transfer_numeric.sql` after validation period
- Why: Maintains type symmetry and ADR 001 compliance (Sacred Integer Arithmetic)

---

## Known Bugs & Edge Cases

- [ ] **Main Currency Fix:** Resolve the bug where changing the "Main Currency" breaks existing balance calculations
- [ ] **Duplicate Detection:** Improve fuzzy matching logic in Inbox to reduce false negatives on duplicates
- [ ] **Import Edge Cases:** Better error handling for Excel files with malformed headers

---

## Codebase Bloat Cleanup (Assessed 2026-02-05)

> **Context:** Full codebase audit of 375 TS/TSX source files (541 total, 64k lines). Overall the codebase is moderately lean with clean architecture, but these specific areas need attention.

### Quick Wins (< 30 min)
- [ ] **Gitignore `.next/` build output:** ~67 MB of build artifacts committed to repo. Add `.next/`, `tsconfig.tsbuildinfo`, `.DS_Store` to `.gitignore` and untrack
- [ ] **Delete duplicate SQL snapshot:** Root-level `current_live_snapshot.sql` (3,005 lines) duplicates `supabase/current_live_snapshot.sql` (1,975 lines)
- [ ] **Delete dead `cents-parser.ts`:** `lib/utils/cents-parser.ts` has zero imports anywhere in the codebase - entirely dead code
- [ ] **Delete deprecated settings re-export shims:** `features/settings/components/reconciliation-form-modal.tsx` and `reconciliation-settings.tsx` are 6-line `@deprecated` re-exports that can be removed
- [ ] **Remove deprecated type aliases:** `IGroupingOperations`, `GroupingErrorCode`, `GroupingOperationError`, `isGroupingOperationError` in `domain/categories.ts` have 0 active imports
- [ ] **Remove unused Babel devDependencies:** `@babel/plugin-proposal-decorators` and `@babel/plugin-transform-class-properties` (~12 MB) - Next.js 16 handles transpilation natively
- [ ] **Run `npm prune`:** 5 extraneous WASM packages (~20-30 MB) installed but not in package.json

### Medium Effort (1-2 hours)
- [ ] **Consolidate currency conversion utils:** `toCents()`/`fromCents()` defined in both `lib/utils/cents-conversion.ts` (primary, 4 imports) and `lib/utils/balance-logic.ts` (1 import) - pick single source of truth
- [ ] **Clean deprecated data-transformers:** 3 functions in `lib/data/data-transformers.ts` marked `TODO: DEPRECATED` for RPC migration
- [ ] **Remove `.gitkeep` stubs:** 15 `.gitkeep` files in directories that already have content
- [ ] **Consolidate Sentry configs:** 3 separate files (`sentry.server.config.ts`, `sentry.client.config.ts`, `sentry.edge.config.ts`) could be consolidated

### Large Effort (Future Sprint)
- [ ] **Abstract shared repository base:** Local-vs-Supabase repository pattern duplicates ~3,500 lines of near-identical CRUD across categories (2,098 lines), transactions (1,736 lines), inbox (1,289 lines), and accounts (~1,000 lines)
- [ ] **Standardize modal component pattern:** 3 different modal approaches coexist (`FormModal`, `EntityModal`, `DashboardModal`) - pick one pattern
- [ ] **Address 22 TODO comments:** Concentrated in transaction/inbox repositories (exchange rate handling, batch RPC optimization, delta sync)

### Not Bloat (Confirmed Clean)
- No orphaned routes, no commented-out code, no unused CSS
- Dependencies well-chosen (single date lib, single state manager, no Redux imported directly)
- Public assets tiny (~2.5 KB), documentation purposeful (18 .md files)
- Barrel index files (27) are well-organized and intentional
- Test coverage is low (16 test files / 375 source = 4.3%) but that's a separate concern

---

## Future Roadmap

- [ ] **Budgeting Module:** Create database schema and UI for setting monthly category budgets
- [ ] **Net Wealth Tracker:** Dashboard to track assets (accounts, investments) vs liabilities over time
- [ ] **Expense Sharing:** Functionality to share expenses or split bills with other users
- [ ] **Recurring Transactions:** Engine to automatically generate transactions for subscriptions/rent
- [ ] **Investment Tracking:** Support for tracking stock units/prices in accounts
- [ ] **Multi-user Households:** Allow sharing accounts between two Auth users
- [ ] **AI Categorization:** Use LLM to suggest categories for Inbox items based on history
