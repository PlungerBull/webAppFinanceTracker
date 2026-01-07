# Project Roadmap & Tasks

**How to use this file:**

* **Do not move tasks.** When you finish a task, check the box `[x]` and add the completion date at the end of the line (e.g., `(Completed: 2026-01-06)`).
* **Cleanup:** Periodically delete lines that have been completed for a while to keep the list clean.

## To-Do's

- [ ] **Eject Direct API Calls:** Remove all direct `supabase.from()` calls in `features/transactions/api/transactions.ts`. The UI must never speak to the server directly.
- [ ] **Install Local Database:** Add WatermelonDB (recommended for React/React Native parity) or RxDB to `package.json`.
- [ ] **Define Client-Side Schema:** Replicate the robust SQL schema found in `DB_SCHEMA.md` into a JavaScript/JSON schema for the local DB.
- [ ] **Implement Sync Engine:** Build the "Pull" (fetch changes) and "Push" (send offline commits) synchronization logic.
- [ ] **Rewrite Hooks:** Refactor `useTransactions` to subscribe to the local database observables instead of React Query promises.
- [ ] **Install Test Runner:** Add `vitest` and `@testing-library/react` immediately. We currently have zero test coverage.
- [ ] **CI Pipeline:** Create a GitHub Action to block merges that fail type checks or linting.
- [ ] **Error Boundary:** Wrap the application root in a global Error Boundary (e.g., Sentry) to catch white-screen crashes.
- [ ] **Data Visualization:** Implement charts for "Monthly Spending" in the Dashboard.
- [ ] **Mobile Responsiveness:** Audit `transaction-table` and `sidebar` for mobile viewports.
- [ ] **Import Optimization:** Fix timeouts on large Excel imports (See migration `20260104200000_fix_import_timeout.sql` for context).

## Known Issues

- [ ] **Duplicate Detection:** Improve fuzzy matching logic in Inbox to reduce false negatives on duplicates.
- [ ] **Import Edge Cases:** Better error handling for Excel files with malformed headers.

## Future Roadmap

- [ ] **Budgeting Module:** Create database schema and UI for setting monthly category budgets.
- [ ] **Net Wealth Tracker:** Dashboard to track assets (accounts, investments) vs liabilities over time.
- [ ] **Expense Sharing:** Functionality to share expenses or split bills with other users.
- [ ] **Recurring Transactions:** Engine to automatically generate transactions for subscriptions/rent.
- [ ] **Investment Tracking:** Support for tracking stock units/prices in accounts.
- [ ] **Multi-user Households:** Allow sharing accounts between two Auth users.
- [ ] **AI Categorization:** Use LLM to suggest categories for Inbox items based on history.
