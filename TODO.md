# Project Roadmap & Tasks

## Architecture & Logic Portability

### Auth Provider Injection
- [ ] Replace direct `supabase.auth.getUser()` calls in all API/Service layers with `IAuthProvider` interface to support Native Apple Auth on iOS

---

## Frontend & Type Safety

- [x] **Normalization Consistency:** Verify that all data entry points correctly utilize the transformer layer for null/undefined normalization

---

## Reliability & Go-Live Readiness

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
- [ ] **Inbox Service Test:** Fix `inbox-service.test.ts:81` — constructor call expects 2 arguments but receives 0 (pre-existing)

---

## Future Roadmap

- [ ] **Budgeting Module:** Create database schema and UI for setting monthly category budgets
- [ ] **Net Wealth Tracker:** Dashboard to track assets (accounts, investments) vs liabilities over time
- [ ] **Expense Sharing:** Functionality to share expenses or split bills with other users
- [ ] **Recurring Transactions:** Engine to automatically generate transactions for subscriptions/rent
- [ ] **Investment Tracking:** Support for tracking stock units/prices in accounts
- [ ] **Multi-user Households:** Allow sharing accounts between two Auth users
- [ ] **AI Categorization:** Use LLM to suggest categories for Inbox items based on history
