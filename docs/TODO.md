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
- [x] ~~**Gitignore `.next/` build output:**~~ Already gitignored and not tracked. No action needed.
- [x] **Delete duplicate SQL snapshot:** Root-level `current_live_snapshot.sql` deleted (was 3,005-line duplicate of `supabase/` copy)
- [x] ~~**Delete dead `cents-parser.ts`:**~~ FALSE — has 4 active imports (inbox-detail-panel, transaction-detail-panel, bulk-action-bar, use-transfer-calculation)
- [x] **Delete deprecated settings re-export shims:** Deleted `reconciliation-form-modal.tsx` and `reconciliation-settings.tsx` from `features/settings/components/`
- [x] **Remove deprecated type aliases:** Removed `IGroupingOperations`, `GroupingErrorCode`, `GroupingOperationError`, `isGroupingOperationError` from `domain/categories.ts` and `domain/index.ts`
- [x] ~~**Remove unused Babel devDependencies:**~~ FALSE — actively required by `babel.config.js` for WatermelonDB decorator support
- [x] **Run `npm prune`:** Removed 5 extraneous WASM packages (`@emnapi/core`, `@emnapi/runtime`, `@emnapi/wasi-threads`, `@napi-rs/wasm-runtime`, `@tybys/wasm-util`)

### Medium Effort (1-2 hours)
- [x] **Consolidate currency conversion utils:** Deleted duplicate `toCents()`/`fromCents()` from `lib/utils/balance-logic.ts` (naive `Math.round` — IEEE 754 footgun). Repointed 2 imports to `lib/utils/cents-conversion.ts` (string-based parser, single source of truth per Manifesto §2)
- [x] **Clean deprecated data-transformers:** Deleted 3 commented-out functions in `lib/data/data-transformers.ts` for removed `account_currencies` table (zero imports)
- [x] ~~**Remove `.gitkeep` stubs:**~~ INVALID — All 15 `.gitkeep` files are in empty `__tests__/` directories (intentional scaffolding per Manifesto §8). Directories with actual tests don't have `.gitkeep`. No action needed.
- [x] ~~**Consolidate Sentry configs:**~~ INVALID — 3 separate files are **required** by `@sentry/nextjs` SDK for 3 different runtimes (Node.js server, browser, Edge). `instrumentation.ts` conditionally imports by `NEXT_RUNTIME`. Not consolidatable.

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
