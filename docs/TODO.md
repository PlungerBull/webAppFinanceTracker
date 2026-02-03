# Project Roadmap & Tasks

## Reliability & Go-Live Readiness

- [ ] **Import Optimization:** Fix timeouts on large Excel/CSV imports
- [ ] **Transaction View Latency:** Optimize `transactions_view` in Supabase to handle larger datasets more efficiently

---

## Sync Hardening Backlog (Post S-Tier Sprint)

> **Context:** During the S-Tier Sync Infrastructure Hardening sprint (2026-02-02), these items were identified but intentionally deferred to maintain focus on core sync reliability.

### Pre-existing Test Failures
- [x] **db-row-schemas.test.ts:** Fix 9 failing schema validation tests that predate the sync-hardening sprint
- [x] **supabase-inbox-repository.test.ts:** Fix 3 failing tests related to inbox repository logic (version conflict handling, tombstone dismissal)

### Sync Conflict UI - Incomplete Actions
- [x] **"Delete Locally" Action:** Implement logic to safely prune a conflicted record from WatermelonDB (placeholder at `sync-conflict-modal.tsx:131-134`)
  - *Completed 2026-02-02: Added `deleteConflictRecord()` to DeltaSyncEngine with race condition protection, threaded through useDeltaSync hook and SyncStatusProvider, added DeleteDialog confirmation UI*
- [x] **"Retry-by-Item" Granularity:** Current "Retry Sync" triggers full `forceSync()`; add ability to retry individual conflicted records
  - *Completed 2026-02-02: Added `retryConflictRecord()` to DeltaSyncEngine, exposed via useDeltaSync hook and SyncStatusProvider, added per-item Retry button with loading state and UI Row Lock in sync-conflict-modal*

### Technical Debt - Next Hardening Phase
- [ ] **syncError Model Field:** Add dedicated field to WatermelonDB models to store specific error messages from the database (currently uses generic CONFLICT status)
- [ ] **Category FK Audit:** Apply same multi-layer defensive validation to `category_id` that was applied to `account_id` and `group_id`
- [ ] **E2E Conflict Resolution Tests:** Add Playwright tests simulating a user physically resolving a conflict via the Sync Conflict Modal UI
- [ ] **Conflict Count Sidebar Badge:** Add visual indicator in sidebar showing number of unresolved sync conflicts

---

## Code Consistency Issues

### 5. Test Co-location Inconsistency
> **Rule:** Tests should be located consistently

- [ ] **Audit:** Transactions has visible `__tests__` folders co-located inside `hooks/` and `services/`
- [ ] **Standardize:** Other features do not show visible test folders - ensure consistent test placement or add missing tests
- Why: Inconsistent folder structures slow down developer navigation

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

### 8. Serialization Bloat (Mobile Performance)
> **Rule:** Entities should only carry data they actually use, especially for lists with hundreds of items

- [ ] **Inbox:** Remove nested `account` and `category` objects from `InboxItemViewEntity`
  - The UI (`inbox-card.tsx`) ignores these nested objects and fetches its own reference data via hooks (`useAccountsData`)
  - Currently double-fetching and serializing data
- Why: For the iOS bridge, passing thousands of redundant nested objects across the JSON boundary is a performance killer

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
