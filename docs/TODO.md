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

### ~~3. Auth Abstraction Parity~~ ✅ COMPLETED

**Problem:** The auth feature leaks implementation details by calling `supabase.auth.*` directly in 8 credential operations (signUp, login, resetPassword, etc.). This prevents the system from swapping the auth layer for Apple Native Sign-In on iOS.

**Solution Applied:** Multi-Provider Strategy Pattern with IoC.
- `IAuthProvider` - Identity operations (already complete)
- `ICredentialAuthProvider` - Email/password operations (web only)
- `IOAuthAuthProvider` - OAuth operations (iOS Apple Sign-In)

**Files Created:**
- [x] `lib/auth/credential-auth-provider.interface.ts`: ICredentialAuthProvider contract with DataResult pattern
- [x] `lib/auth/supabase-credential-provider.ts`: Extracted 8 supabase.auth.* calls with error mapping
- [x] `lib/auth/oauth-auth-provider.interface.ts`: IOAuthAuthProvider contract for Apple/Google Sign-In

**Files Modified:**
- [x] `domain/auth.ts`: Added AuthMethod, SignInResult, SignUpResult, CredentialErrorCode, CredentialAuthError types
- [x] `lib/auth/index.ts`: Added exports for new interfaces and implementations
- [x] `features/auth/api/auth.ts`: Multi-provider factory with capability checks (hasCredentialAuth, hasOAuthAuth)
- [x] `providers/auth-provider.tsx`: Inject credential provider at composition root
- [x] `app/login/page.tsx`: Updated to use DataResult pattern
- [x] `app/signup/page.tsx`: Updated to use DataResult pattern
- [x] `app/reset-password/page.tsx`: Updated to use DataResult pattern
- [x] `app/reset-password/update/page.tsx`: Updated to use DataResult pattern
- [x] `components/settings/change-password-modal.tsx`: Updated to use DataResult pattern
- [x] `components/settings/change-email-modal.tsx`: Updated to use DataResult pattern
- [x] `docs/ARCHITECTURE.md`: Section 10 with multi-provider documentation

### 4. Transformer Standardization

**Problem:** Several "Read-Heavy" features bypass the central Transformer Registry, performing manual `forEach` or `.map()` transformations. This leads to logic drift where snake_case to camelCase conversion is handled inconsistently.

**Files to Modify:**
- [x] `features/dashboard/hooks/use-financial-overview.ts`: Move manual mapping logic (lines 78–127) to `lib/data/data-transformers.ts`
  - Added `dbMonthlySpendingToDomain()` Domain Guard transformer with sanitization, type predicates, and Virtual Parent injection
  - Added `isValidMonthKey()` type guard for YYYY-MM format validation
  - Added `MonthlySpendingDbRow`, `CategoryLookupEntry`, `CategoryMonthlyData` exported types
  - Added comprehensive unit tests in `lib/data/__tests__/data-transformers.test.ts` (17 tests)
- [x] `features/inbox/components/inbox-table.tsx`: Extract the large 25-field inline mapping to a dedicated transformer function
  - Added `inboxItemViewToTransactionView()` and `inboxItemViewsToTransactionViews()` to `lib/data/data-transformers.ts`
  - Refactored `inbox-card.tsx` to use `useAccountsData()` orchestrator instead of direct `useAccounts()` import

### 5. Type Safety & Boundary Validation

**Problem:** Use of `any` types in high-traffic interfaces and a lack of Zod validation on specific RPC results create "blind spots" in the type safety net.

**Files to Modify:**
- [x] `features/import-export/services/data-import-service.ts`: Replace the type assertion on `rpcResult` (line 103) with a proper `.parse()` using a new `ImportResultRpcSchema`
  - Added `ImportResultRpcSchema` to `lib/data/db-row-schemas.ts`
  - Replaced `as` type assertion with `validateOrThrow(ImportResultRpcSchema, data, 'ImportResultRpc')`
- [x] `features/settings/components/profile-settings.tsx`: Replace `user: any` with the proper `AuthUserEntity` type
  - Used platform-agnostic `AuthUserEntity | null` from `@/domain/auth` (follows architecture abstraction)
  - Updated property accesses from `user_metadata.firstName/lastName` to `firstName/lastName`
- [x] `features/inbox/repository/supabase-inbox-repository.ts`: Fix the `any` cast in the version conflict fallback query
  - Added local `VersionCheckSchema` for the fallback query validation
  - Replaced `(currentItem as any).version` with `validateOrThrow(VersionCheckSchema, currentItem, 'VersionCheck').version`

### 6. Code Hygiene & Deduplication

**Problem:** Minor copy-paste errors and redundant logic identified during deep-dives.

**Files to Modify:**
- [x] `features/dashboard/hooks/use-financial-overview.ts`: Remove the duplicate assignment on lines 108–109
  - Fixed as part of Transformer Standardization refactor (item #4)


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
