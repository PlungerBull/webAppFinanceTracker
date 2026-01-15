# Project Roadmap & Tasks

## Repository Pattern Implementation

### Transactions Feature: ✅ Migrated

### Inbox Feature: ❌ Legacy
- [ ] Create `InboxEntity` in domain layer (integer cents, typed status)
- [ ] Create `IInboxRepository` interface + `SupabaseInboxRepository` implementation
- [ ] Create `InboxService` with DataResult pattern
- [ ] Create new React Query hooks using service layer
- [ ] Migrate `use-inbox.ts` from direct `inboxApi.ts` calls
- [ ] Deprecate `features/inbox/api/inbox-api.ts`

### Transfers Feature: ❌ Legacy
- [ ] Create `TransferEntity` in domain layer
- [ ] Create `ITransferRepository` interface + `SupabaseTransferRepository` implementation
- [ ] Create `TransferService` with DataResult pattern (align with Transaction service)
- [ ] Migrate `use-transfers.ts` from direct `transfersApi.ts` calls
- [ ] Ensure `createTransfer` RPC returns structured DataResult

### Accounts Feature: ❌ Legacy
- [ ] Create `AccountEntity` in domain layer (integer cents for balances)
- [ ] Create `IAccountRepository` interface + `SupabaseAccountRepository` implementation
- [ ] Create `AccountService` with DataResult pattern
- [ ] Migrate `use-accounts.ts` from direct `accountsApi.ts` calls
- [ ] Deprecate `features/accounts/api/accounts-api.ts`

### Phase 2 - Offline Sync (Future)
- [ ] Install Local Database: Add WatermelonDB or RxDB to `package.json`
- [ ] Define Client-Side Schema: Replicate SQL schema into JavaScript/JSON schema
- [ ] Implement Sync Engine: Build "Pull" (fetch changes) and "Push" (send offline commits) logic
- [ ] Rewrite Hooks: Subscribe to local database observables instead of React Query
- [ ] Delta Sync API: Implement `getChangesSince(version)` endpoint

## General Tasks
- [ ] **Install Test Runner:** Add `vitest` and `@testing-library/react` immediately. We currently have zero test coverage.
- [ ] **CI Pipeline:** Create a GitHub Action to block merges that fail type checks or linting.
- [ ] **Error Boundary:** Wrap the application root in a global Error Boundary (e.g., Sentry) to catch white-screen crashes.
- [ ] **Mobile Responsiveness:** Audit `transaction-table` and `sidebar` for mobile viewports.
- [ ] **Import Optimization:** Fix timeouts on large Excel imports (See migration `20260104200000_fix_import_timeout.sql` for context).



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
