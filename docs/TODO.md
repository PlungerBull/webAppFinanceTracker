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


### 9. Legacy create_transfer NUMERIC Signatures
> **Technical Debt:** Old RPC signatures violate ADR 001 (Floating-Point Rejection)

- [ ] **Drop:** Legacy `create_transfer` overloads that use NUMERIC (dollars) instead of BIGINT (cents)
- **Location:** Two overloads in `current_live_snapshot.sql` lines 611-689 and 693+
- **Blocked By:** Verify S-Tier BIGINT overload works in production first
- **Migration:** Create `drop_legacy_create_transfer_numeric.sql` after validation period
- Why: Maintains type symmetry and ADR 001 compliance (Sacred Integer Arithmetic)

### 7. Folder Structure Schism
> **Rule:** Clean Architecture requires explicit layers: `repository/` (data access) and `services/` (business logic)

- [x] **Reconciliations:** Split `api/reconciliations.ts` into `repository/` + `services/` layers
- [x] **Settings:** Move `api/user-settings.ts` to `services/user-settings.ts`
- [x] **Transactions:** Delete `api/filters.ts` (dead code - was not imported anywhere)
- Reference: Accounts & Categories follow the rule perfectly
- Status: **COMPLETED** - All features now follow Clean Architecture pattern

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
