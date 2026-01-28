# Project Roadmap & Tasks

## Reliability & Go-Live Readiness

- [ ] **Mobile Responsiveness:** Audit `transaction-table` and `sidebar` for mobile viewports
- [ ] **Import Optimization:** Fix timeouts on large Excel/CSV imports


---

## Known Bugs & Edge Cases

- [ ] **Main Currency Fix:** Resolve the bug where changing the "Main Currency" breaks existing balance calculations
- [ ] **Duplicate Detection:** Improve fuzzy matching logic in Inbox to reduce false negatives on duplicates
- [ ] **Import Edge Cases:** Better error handling for Excel files with malformed headers

---

## Implementation Steps (Go-Live Countdown)

- [ ] **Hard-Gate Auth:** Finish replacing all direct `supabase.auth.getUser()` calls with the `IAuthProvider` injection to ensure the iOS app can use Native Apple Auth.
- [ ] **Infrastructure Hardening:** Create a GitHub Action to block merges that fail Vitest unit tests or Zod schema validation.
- [ ] **Performance Audit:** Replace `watch()` in react-hook-form with `useWatch` or `useFormContext` to ensure compatibility with the React Compiler and prevent UI lag on low-end devices.
- [ ] **Beta Release:** Once the "Main Currency" bug is resolved, move to a private Beta with 5 users to stress-test the Delta Sync Engine under high-latency conditions.

---

## Future Roadmap

- [ ] **Budgeting Module:** Create database schema and UI for setting monthly category budgets
- [ ] **Net Wealth Tracker:** Dashboard to track assets (accounts, investments) vs liabilities over time
- [ ] **Expense Sharing:** Functionality to share expenses or split bills with other users
- [ ] **Recurring Transactions:** Engine to automatically generate transactions for subscriptions/rent
- [ ] **Investment Tracking:** Support for tracking stock units/prices in accounts
- [ ] **Multi-user Households:** Allow sharing accounts between two Auth users
- [ ] **AI Categorization:** Use LLM to suggest categories for Inbox items based on history

---

## Recently Completed

- [x] **Dual `types/` Consolidation:** Renamed `lib/types/` → `lib/data/` to clarify semantic roles. `types/` holds pure type definitions (stripped at build); `lib/data/` holds runtime validation, Zod schemas, and transformers. (2026-01-27)
- [x] **Hooks Consolidation:** Moved `hooks/` → `lib/hooks/` to resolve dual-location ambiguity. (2026-01-27)
- [x] **WatermelonDB Repo Alignment:** Aligned local repositories with shared `local-data-transformers`. (2026-01-27)
- [x] **PII Scrubber & Sentry Hardening:** Wired allowlist-based PII scrubber into Sentry configs. (2026-01-27)
