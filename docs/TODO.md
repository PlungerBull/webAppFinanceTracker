# Project Roadmap & Tasks

## Reliability & Go-Live Readiness

- [ ] **Import Optimization:** Fix timeouts on large Excel/CSV imports


---

## Architecture & Technical Debt (Audit of Audits)

Production readiness and iOS native port preparation tasks identified from comprehensive feature audits.

### ~~1. Sync Integrity Hardening (Reconciliations)~~ ✅ COMPLETED

**Problem:** The reconciliations module is a "sync blocker" because it lacks the necessary metadata for the Delta Sync Engine. It uses hard deletes instead of the Tombstone Pattern and is missing the optimistic concurrency versioning used by the rest of the system.

**Files Modified:**
- [x] `supabase/migrations/20260129030000_reconciliations_sync_hardening.sql`: Added `version` and `deleted_at` columns with auto-increment trigger
- [x] `supabase/migrations/20260129030001_reconciliation_version_ops.sql`: Created `delete_reconciliation_with_version` RPC
- [x] `supabase/migrations/20260129030002_reconciliations_tombstone_indexes.sql`: Added partial indexes for performance
- [x] `features/reconciliations/api/reconciliations.ts`: Updated delete to use version-checked soft delete RPC, added tombstone filters
- [x] `lib/data/db-row-schemas.ts`: Added `...BaseSyncFields` to `ReconciliationRowSchema`
- [x] `domain/reconciliations.ts`: Created domain file with `Reconciliation`, `ReconciliationSummary`, and type guards
- [x] `lib/data/data-transformers.ts`: Updated transformer for sync fields, imports from `@/domain/reconciliations`
- [x] `features/reconciliations/hooks/use-reconciliations.ts`: Updated delete mutation for version parameter
- [x] `features/settings/components/reconciliation-settings.tsx`: Updated UI to pass version on delete

### ~~2. Feature Bleed Remediation (The "Spaghetti" Fix)~~ ✅ COMPLETED

**Problem:** Systemic violations where features import directly from other features (40+ instances), creating tight coupling that threatens the modularity required for the React Compiler and separate platform builds.

**Solution Applied:** DDD + Clean Architecture with Domain Isolation, Inversion of Control, and ESLint Enforcement.

**Files Created:**
- [x] `domain/accounts.ts`: AccountEntity, AccountViewEntity, type guards
- [x] `domain/categories.ts`: CategoryEntity, LeafCategoryEntity, type guards
- [x] `domain/inbox.ts`: InboxItemViewEntity, DTOs, IInboxOperations interface
- [x] `domain/reconciliations.ts`: Reconciliation, ReconciliationSummary, type guards
- [x] `domain/index.ts`: Barrel export for Sacred Domain
- [x] `lib/hooks/use-reference-data.ts`: Orchestrator hook for accounts, categories, currencies
- [x] `lib/hooks/use-inbox-operations.ts`: IoC adapter wrapping InboxService
- [x] `lib/schemas/profile.schema.ts`: Moved from features/auth

**Files Refactored:**
- [x] `features/transactions/services/transaction-routing-service.ts`: Uses IInboxOperations interface (IoC)
- [x] `features/transactions/hooks/use-transaction-routing.ts`: Uses useInboxOperations hook
- [x] `features/transactions/hooks/use-transaction-update.ts`: Uses useInboxOperations hook
- [x] `features/transactions/components/category-selector.tsx`: Uses useCategoriesData
- [x] `features/settings/components/reconciliation-settings.tsx`: Uses useAccountsData
- [x] `features/settings/components/reconciliation-form-modal.tsx`: Uses useAccountsData
- [x] `features/settings/components/currency-settings.tsx`: Uses useCurrenciesData
- [x] `features/settings/components/appearance-settings.tsx`: Uses useAccountsData
- [x] `features/settings/components/profile-settings.tsx`: Imports from @/lib/schemas
- [x] `features/inbox/components/inbox-detail-panel.tsx`: Uses useReferenceData
- [x] `eslint.config.mjs`: Added no-restricted-imports rules for feature boundaries

### 3. Auth Abstraction Parity

**Problem:** The auth feature leaks implementation details by calling `supabase.auth.*` directly in 12 locations. This prevents the system from swapping the auth layer for Apple Native Sign-In on iOS.

**Files to Modify:**
- [ ] `features/auth/api/auth.ts`: Refactor all session and identity methods (e.g., `getUser`, `getSession`) to route through the `IAuthProvider` interface

### 4. Transformer Standardization

**Problem:** Several "Read-Heavy" features bypass the central Transformer Registry, performing manual `forEach` or `.map()` transformations. This leads to logic drift where snake_case to camelCase conversion is handled inconsistently.

**Files to Modify:**
- [ ] `features/dashboard/hooks/use-financial-overview.ts`: Move manual mapping logic (lines 78–127) to `lib/data/data-transformers.ts`
- [ ] `features/inbox/components/inbox-table.tsx`: Extract the large 25-field inline mapping to a dedicated transformer function

### 5. Type Safety & Boundary Validation

**Problem:** Use of `any` types in high-traffic interfaces and a lack of Zod validation on specific RPC results create "blind spots" in the type safety net.

**Files to Modify:**
- [ ] `features/import-export/services/data-import-service.ts`: Replace the type assertion on `rpcResult` (line 103) with a proper `.parse()` using a new `ImportResultRpcSchema`
- [ ] `features/settings/components/profile-settings.tsx`: Replace `user: any` with the proper Supabase `User` type
- [ ] `features/inbox/repository/supabase-inbox-repository.ts`: Fix the `any` cast in the version conflict fallback query

### 6. Code Hygiene & Deduplication

**Problem:** Minor copy-paste errors and redundant logic identified during deep-dives.

**Files to Modify:**
- [ ] `features/dashboard/hooks/use-financial-overview.ts`: Remove the duplicate assignment on lines 108–109


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
