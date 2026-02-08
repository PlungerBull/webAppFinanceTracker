# Project Roadmap & Tasks

## Reliability & Go-Live Readiness

- [x] **Import Optimization:** Fix timeouts on large Excel/CSV imports — chunked import (500-row batches) with progress bar and CSV support
- [x] **Transaction View Latency:** Optimize `transactions_view` in Supabase to handle larger datasets more efficiently
- [x] **OCC Ghost-Version Fix:** Parsed real server version from PostgreSQL error (was hardcoded -1), added auto-retry on version conflict during inbox promotion

---

## Sync Hardening Backlog (Post S-Tier Sprint)

> **Context:** During the S-Tier Sync Infrastructure Hardening sprint (2026-02-02), these items were identified but intentionally deferred to maintain focus on core sync reliability.

### Technical Debt - Next Hardening Phase
- [ ] **E2E Conflict Resolution Tests:** Add Playwright tests simulating a user physically resolving a conflict via the Sync Conflict Modal UI
- [ ] **Conflict Count Sidebar Badge:** Add visual indicator in sidebar showing number of unresolved sync conflicts

---

## Known Bugs & Edge Cases

- [ ] **Main Currency Fix:** Resolve the bug where changing the "Main Currency" breaks existing balance calculations
- [ ] **Duplicate Detection:** Improve fuzzy matching logic in Inbox to reduce false negatives on duplicates
- [ ] **Import Edge Cases:** Better error handling for Excel files with malformed headers

---

## Codebase Bloat Cleanup (Assessed 2026-02-05)

> **Context:** Full codebase audit of 375 TS/TSX source files (541 total, 64k lines). Overall the codebase is moderately lean with clean architecture, but these specific areas need attention.


### Large Effort (Future Sprint)
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
