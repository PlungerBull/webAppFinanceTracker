# Project Roadmap & Tasks

## Architecture & Logic Portability

### Transactions Feature: ✅ Migrated

### Auth Provider Injection
- [ ] Replace direct `supabase.auth.getUser()` calls in all API/Service layers with `IAuthProvider` interface to support Native Apple Auth on iOS

### Legacy Code Removal
- [ ] Physically delete `features/transactions/api/transactions.ts` to prevent accidental legacy imports
- [ ] Remove all `.OLD.ts` files from the codebase

---

## God Component Refactors (iOS Port Prep)

> **CTO Note:** These files violate the Single Responsibility Principle and must be broken down before scaling to iOS. Smaller components map cleanly to native ViewControllers/SwiftUI Views.

### 1. AllTransactionsTable.tsx (Critical)

Currently manages: Filter State, Bulk Selection, Data Fetching, Complex Handlers (Shift+Click range selection, multi-currency linking), and UI Layout.

- [ ] **Extract `TransactionFilterBar`:** Move search, date, and category filter logic into self-contained component
- [ ] **Extract `BulkSelectionController`:** Move selection modifier logic (Shift/Cmd clicks) and bulk action handlers into custom hook or controller component
- [ ] **Modularize `TransactionsContent`:** Break the ~200-line main function into sub-sections or smaller functional components

### 2. AddTransactionModal.tsx

Currently handles two domains (Ledger Transactions + Internal Transfers) with separate state blocks, validation logic, and mutation calls. Also contains the "Smart Routing" logic leak.

- [ ] **Split by Mode:** Create separate `LedgerTransactionModal` and `TransferModal` components
- [ ] **Unified Wrapper:** Create lightweight wrapper that only handles mode-switching tab and Dialog state
- [ ] **Service Extraction:** Move submission logic into `TransactionService` so modal only handles UI validation

### 3. TransactionForm.tsx & TransferForm.tsx

Monolithic forms handling complex UI state (SmartSelector interactions) alongside formatting/display logic. TransferForm has multiple useEffects just to resolve account IDs and currencies from group IDs.

- [ ] **Extract `useTransferResolution` hook:** Move currency/account resolution logic from TransferForm
- [ ] **Componentize Inputs:** Break down complex sections (Account/Category/Date footer) into reusable form-field groups

### 4. inbox.ts (API Layer → Repository Pattern)

Growing large handling fetch, update, promote, and dismiss operations in one place.

- [ ] **Split during Repository migration:** Create `InboxRepository` (raw data access) and `InboxService` (business logic like promotion/validation)

---

## Repository Pattern Implementation

### Inbox Feature: ❌ Legacy
- [ ] Create `InboxEntity` in domain layer (integer cents, typed status)
- [ ] Create `IInboxRepository` interface + `SupabaseInboxRepository` implementation
- [ ] Create `InboxService` with DataResult pattern
- [ ] Create new React Query hooks using service layer
- [ ] Migrate `use-inbox.ts` from direct `inboxApi.ts` calls
- [ ] Deprecate `features/inbox/api/inbox-api.ts`
- [ ] Enforce integer cents (`amountCents`) exclusively, eliminating floating-point math
- [ ] Implement version-checked RPCs to prevent silent data overwrites during multi-device sync
- [ ] Enforce strict ISO 8601 date format (`YYYY-MM-DDTHH:mm:ss.SSSZ`) required by Swift

### Transfers Feature: ✅ Migrated
- [x] Update `CreateTransferDTO` in domain layer with `sentAmountCents` and `receivedAmountCents`
- [x] Create `ITransferRepository` interface + `SupabaseTransferRepository` implementation
- [x] Create `TransferService` with DataResult pattern (align with Transaction service)
- [x] Migrate `use-transfers.ts` from direct `transfersApi.ts` calls
- [x] Add optimistic updates for Zero-Latency UX
- [x] Enforce integer cents (`sentAmountCents`, `receivedAmountCents`) exclusively
- [x] Enforce strict ISO 8601 date format (`YYYY-MM-DDTHH:mm:ss.SSSZ`) required by Swift
- [x] Remove duplicate `createTransfer` from Transaction repository (Single Source of Truth)
- [ ] Deprecate `features/transactions/api/transfers.ts`

### Technical Debt
- [ ] **Regenerate Supabase Types:** Run `supabase gen types typescript` to fix nullable RPC parameters (currently using `null as unknown as string` workaround in `supabase-transfer-repository.ts:144`)

### Accounts Feature: ✅ Migrated
- [x] Create `AccountEntity` in domain layer (integer cents for balances)
- [x] Create `IAccountRepository` interface + `SupabaseAccountRepository` implementation
- [x] Create `AccountService` with DataResult pattern
- [x] Migrate `use-accounts.ts` from direct `accountsApi.ts` calls
- [x] Update all UI components to use `AccountViewEntity` (`id`, `currentBalanceCents`)
- [ ] Deprecate `features/accounts/api/accounts.ts`

### Phase 2 - Offline Sync (Future)

> **Architecture Philosophy:** The reason Todoist, TickTick, and similar apps feel so fast is they don't treat the cloud as the only source of truth—they treat it as the **Backup and Sync Coordinator**.

#### Understanding the Architecture

**1. The "Cloud-Based" Misconception**

When you use a web app like Todoist, you are still "in the cloud" because data is stored on their servers. However, the **web app itself functions like local software**:

- **Initial Load:** Internet required to load the website for the first time
- **Offline Operation:** Once loaded, a Service Worker keeps the app running even without Wi-Fi
- **Local State:** Every transaction is written to a local browser database (IndexedDB) *before* it's sent to the server

**2. The "Sync Coordinator" (Server's Role)**

In this model, the server (Supabase) acts as the **Sacred Registry**:

- **Conflict Resolution:** If you add an expense on iPhone and Web simultaneously, the server uses Version-Based Sync to determine "Truth"
- **Delta Syncing:** Server only sends *changes* (deltas) since your last version, not the entire database

**3. Why This Benefits Our iOS Port**

Building the web app with an "offline-ready" mindset makes the iOS port significantly easier:

- **Shared Logic:** Integer Cents math is already in `TransactionService`
- **Identical Protocols:** iOS app will call the same Atomic Transfer RPCs as web
- **Tombstone Pattern:** Soft Delete (`deletedAt`) already exists for iOS cache invalidation during sync

#### Current "Logic Leaks" to Fix First

Before implementing offline sync, we must clean up these architectural issues:

- [ ] **Smart Routing Centralization:** Move transaction routing logic (Ledger vs Inbox) from `AddTransactionModal` into `TransactionService` so iOS can reuse identical routing
- [ ] **Deprecated API Cleanup:** Remove all direct `transactionsApi.ts` references; force all data through Repository Layer for versioning/sync-readiness

#### Implementation Steps

**Phase 2a - Prerequisites**
- [ ] Complete Repository Pattern migration for all features (Inbox, Transfers, Accounts)
- [ ] Ensure all entities have `version` and `deletedAt` fields for sync support
- [ ] Audit and centralize all business logic into Service layer

**Phase 2b - Local Database Setup**
- [ ] Install Local Database: Add WatermelonDB or RxDB to `package.json`
- [ ] Define Client-Side Schema: Replicate SQL schema into JavaScript/JSON schema
- [ ] Set up IndexedDB persistence layer

**Phase 2c - Service Worker & Offline Shell**
- [ ] Configure Service Worker for app shell caching
- [ ] Implement offline detection and UI indicators
- [ ] Queue mutations when offline

**Phase 2d - Sync Engine**
- [ ] Delta Sync API: Implement `getChangesSince(version)` endpoint on server
- [ ] Implement Sync Engine: Build "Pull" (fetch changes) and "Push" (send offline commits) logic
- [ ] Implement conflict resolution strategy (last-write-wins or merge)
- [ ] Rewrite Hooks: Subscribe to local database observables instead of React Query

**Phase 2e - Testing & Hardening**
- [ ] Test offline scenarios (add while offline, sync on reconnect)
- [ ] Test conflict scenarios (simultaneous edits)
- [ ] Performance testing with large datasets

## Frontend & Type Safety

- [ ] **Complete Type Migration:** Finish updating all remaining UI components to use `TransactionViewEntity` instead of deprecated `TransactionView` types
- [ ] **Normalization Consistency:** Verify that all data entry points correctly utilize the transformer layer for null/undefined normalization

---

## Reliability & Go-Live Readiness

- [ ] **Install Test Runner:** Add `vitest` and `@testing-library/react` immediately. We currently have zero test coverage.
- [ ] **Unit Test Core Logic:** Implement unit tests for core balance logic and service-layer business rules
- [ ] **CI Pipeline:** Create a GitHub Action to block merges that fail type checks or linting.
- [ ] **Error Boundary:** Wrap the application root in a global Error Boundary (e.g., Sentry) to catch and report runtime crashes.
- [ ] **Mobile Responsiveness:** Audit `transaction-table` and `sidebar` for mobile viewports.
- [ ] **Import Optimization:** Fix timeouts on large Excel/CSV imports (See migration `20260104200000_fix_import_timeout.sql` for context).

---

## Known Bugs & Edge Cases

- [ ] **Main Currency Fix:** Resolve the bug where changing the "Main Currency" breaks existing balance calculations
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
