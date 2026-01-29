# Project Roadmap & Tasks

## Reliability & Go-Live Readiness

- [ ] **Import Optimization:** Fix timeouts on large Excel/CSV imports


---

## Architecture & Technical Debt (Audit of Audits)

Production readiness and iOS native port preparation tasks identified from comprehensive feature audits.

### 1. Sync Integrity Hardening (Reconciliations)

**Problem:** The reconciliations module is a "sync blocker" because it lacks the necessary metadata for the Delta Sync Engine. It uses hard deletes instead of the Tombstone Pattern and is missing the optimistic concurrency versioning used by the rest of the system.

**Files to Modify:**
- [ ] `supabase/migrations/`: Create a new migration to add `version` (INT) and `deleted_at` (TIMESTAMPTZ) columns to the reconciliations table
- [ ] `api/reconciliations.ts`: Update the delete method to perform a soft update of `deleted_at` instead of a physical `.delete()`
- [ ] `lib/data/db-row-schemas.ts`: Update `ReconciliationRowSchema` to include the new sync fields

### 2. Feature Bleed Remediation (The "Spaghetti" Fix)

**Problem:** Systemic violations where features import directly from other features (40+ instances), creating tight coupling that threatens the modularity required for the React Compiler and separate platform builds.

**Files to Modify:**
- [ ] **Transactions:** Remove imports from `accounts`, `categories`, and `inbox`. Move shared components like `CategorySelector` and hooks like `useAccounts` to `lib/` or `components/shared/`
- [ ] **Settings:** Decouple from `reconciliations` and `currencies` by moving dependency injection to the page level
- [ ] **Inbox:** Remove critical dependencies on transactions components and hooks

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
