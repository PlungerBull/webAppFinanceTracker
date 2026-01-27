# Project Roadmap & Tasks

## Architecture & Logic Portability

### Auth Provider Injection
- [ ] Replace direct `supabase.auth.getUser()` calls in all API/Service layers with `IAuthProvider` interface to support Native Apple Auth on iOS

---
### Remaining

**Phase 2e - Testing & Hardening:** ✅ COMPLETE
- [x] Unit tests for pull-engine pagination (12 tests)
- [x] Unit tests for sync-lock-manager (12 tests)
- [x] Unit tests for push-engine (30 tests including Chain Failure Isolation)
- [x] Unit tests for delta-sync-engine (28 tests including TABLE_DEPENDENCIES)
- [x] Test offline scenarios (13 tests: add while offline, sync on reconnect)
- [x] Test conflict scenarios (19 tests including Temporal Invariance)
- [x] Performance testing with large datasets (14 tests: 1000+ transactions)

**Total: 128 tests across 7 test files**

---

## Frontend & Type Safety

- [ ] **Complete Type Migration:** Finish updating all remaining UI components to use `TransactionViewEntity` instead of deprecated `TransactionView` types
- [ ] **Normalization Consistency:** Verify that all data entry points correctly utilize the transformer layer for null/undefined normalization

---

## Reliability & Go-Live Readiness

- [ ] **CI Pipeline:** Create a GitHub Action to block merges that fail type checks or linting
- [ ] **Error Boundary:** Wrap the application root in a global Error Boundary (e.g., Sentry) to catch and report runtime crashes
- [ ] **Mobile Responsiveness:** Audit `transaction-table` and `sidebar` for mobile viewports
- [ ] **Import Optimization:** Fix timeouts on large Excel/CSV imports

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
