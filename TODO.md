# Project Roadmap & Tasks


- [ ] **Eject Direct API Calls:** Remove all direct `supabase.from()` calls in `features/transactions/api/transactions.ts`. The UI must never speak to the server directly.
- [ ] **Install Local Database:** Add WatermelonDB (recommended for React/React Native parity) or RxDB to `package.json`.
- [ ] **Define Client-Side Schema:** Replicate the robust SQL schema found in `DB_SCHEMA.md` into a JavaScript/JSON schema for the local DB.
- [ ] **Implement Sync Engine:** Build the "Pull" (fetch changes) and "Push" (send offline commits) synchronization logic.
- [ ] **Rewrite Hooks:** Refactor `useTransactions` to subscribe to the local database observables instead of React Query promises.
- [ ] **Install Test Runner:** Add `vitest` and `@testing-library/react` immediately. We currently have zero test coverage.
- [ ] **CI Pipeline:** Create a GitHub Action to block merges that fail type checks or linting.
- [ ] **Error Boundary:** Wrap the application root in a global Error Boundary (e.g., Sentry) to catch white-screen crashes.
- [ ] **Mobile Responsiveness:** Audit `transaction-table` and `sidebar` for mobile viewports.
- [ ] **Import Optimization:** Fix timeouts on large Excel imports (See migration `20260104200000_fix_import_timeout.sql` for context).

## Known Issues

- [ ] **Duplicate Detection:** Improve fuzzy matching logic in Inbox to reduce false negatives on duplicates.
- [ ] **Import Edge Cases:** Better error handling for Excel files with malformed headers.
- [ ] **Main Currency:** This is not fixed, its locked to a single main currency, if you change it you brake eeverything

## Future Roadmap

- [ ] **Budgeting Module:** Create database schema and UI for setting monthly category budgets.
- [ ] **Net Wealth Tracker:** Dashboard to track assets (accounts, investments) vs liabilities over time.
- [ ] **Expense Sharing:** Functionality to share expenses or split bills with other users.
- [ ] **Recurring Transactions:** Engine to automatically generate transactions for subscriptions/rent.
- [ ] **Investment Tracking:** Support for tracking stock units/prices in accounts.
- [ ] **Multi-user Households:** Allow sharing accounts between two Auth users.
- [ ] **AI Categorization:** Use LLM to suggest categories for Inbox items based on history.
