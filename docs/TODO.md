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

### 6. Type Strictness Variance
> **Rule:** Zod schemas should match Domain types exactly

- [ ] **Settings:** Fix `transactionSortPreference` - Domain type is strict union `'date' | 'created_at'` but Zod schema validates as generic `z.string()` with type cast in transformer
- Why: Loses runtime validation for specific enum values

### 7. Folder Structure Schism
> **Rule:** Clean Architecture requires explicit layers: `repository/` (data access) and `services/` (business logic)

- [ ] **Reconciliations:** Split `api/reconciliations.ts` - currently acts as both Repository and Service
- [ ] **Settings:** Rename `api/user-settings.ts` to `services/user-settings.ts`
- [ ] **Transactions:** Audit `api/filters.ts` alongside existing `repository/` and `services/`
- Reference: Accounts & Categories follow the rule perfectly
- Why: Inconsistent naming makes navigation unpredictable. A developer looking for "business logic" in Settings won't find a `services` folder

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
