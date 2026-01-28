# Project Roadmap & Tasks

## Reliability & Go-Live Readiness

- [ ] **Observability (Sentry):** Integrate Sentry (or LogRocket) before leaving Phase 2 — capture `SyncCycleResult` failures and runtime errors in real-time so we can "see" what breaks in production (e.g., sync failing on a subway in London)
- [ ] **CI Pipeline:** Create a GitHub Action to block merges that fail type checks or linting
- [ ] **Error Boundary:** Wrap the application root in a global Error Boundary (e.g., Sentry) to catch and report runtime crashes
- [ ] **Mobile Responsiveness:** Audit `transaction-table` and `sidebar` for mobile viewports
- [ ] **Import Optimization:** Fix timeouts on large Excel/CSV imports

---

## Post-Phase 2 Cleanup

- [ ] **Inbox Magic Strings:** Purge `'Unknown Account'` / `'Unknown Category'` display fallbacks from `dbInboxItemViewToDomain()` in `data-transformers.ts` — return `null` and move display logic to UI components (matches CTO mandate applied to transactions/accounts)
- [ ] **WatermelonDB Transformer Alignment:** Audit local repositories (`local-*-repository.ts`) to ensure they use shared transformers from `data-transformers.ts` — critical for iOS port data parity

---

## Known Bugs & Edge Cases

- [ ] **Main Currency Fix:** Resolve the bug where changing the "Main Currency" breaks existing balance calculations
- [ ] **Duplicate Detection:** Improve fuzzy matching logic in Inbox to reduce false negatives on duplicates
- [ ] **Import Edge Cases:** Better error handling for Excel files with malformed headers
- [x] **Inbox Service Test:** Fix `inbox-service.test.ts:81` — constructor call expects 2 arguments but receives 0 (pre-existing)

---

## Implementation Steps (Go-Live Countdown)

- [ ] **Hard-Gate Auth:** Finish replacing all direct `supabase.auth.getUser()` calls with the `IAuthProvider` injection to ensure the iOS app can use Native Apple Auth.
- [ ] **Infrastructure Hardening:** Create a GitHub Action to block merges that fail Vitest unit tests or Zod schema validation.
- [ ] **Global Error Boundary:** Wrap the application root in a Sentry boundary to catch and report runtime crashes.
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
