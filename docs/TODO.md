# Project Roadmap & Tasks

## 🛑 P0: Sacred Mandate Violations

- [x] **Repository Pattern Breach (Categories):** ~~The file `utils/validation.ts` in the categories feature performs direct Supabase client calls for hierarchy and transaction checks.~~ **RESOLVED:** Validation logic moved to S-Tier architecture with pure service methods (`validateDeletion`, `validateHierarchyChange`, `validateIsSubcategory`) and orchestrator pattern (`canDelete` in `use-category-operations.ts`). File `validation.ts` deleted.
- [x] **Environment Boundary Risk (Validation):** ~~Because `validation.ts` currently bypasses the repository, it lacks the necessary server-only guards or client/server separation.~~ **RESOLVED:** Repository methods (`getChildCount` in categories, `getCountByCategory` in transactions) provide offline-first data access. Pure validation methods are synchronous and receive context as arguments.

---

## ⚠️ P1: Modular Drift & Feature Bleed

- [x] **Feature Bleed (Groupings):** ~~There are six distinct violations in the groupings feature where components and hooks import directly from the categories feature instead of the sacred domain.~~ **RESOLVED:** All 4 domain imports now use `@/domain/categories`. UI component violations fixed via "Smart Logic, Dumb Shells" composition pattern with `EntityModal` shell + feature-specific forms (`AddGroupingForm`, `EditGroupingForm`).
- [x] **IoC Violation (Groupings):** ~~The direct import of UI components from one feature into another breaks the "Feature Firewall" and prevents the iOS port from mapping these as independent Swift modules.~~ **RESOLVED:** Features are now fully decoupled. Groupings feature has zero imports from `@/features/categories`. New shared shell at `@/components/shared/entity-modal.tsx`.

---

## ⚙️ P2: Hygiene, Performance & Technical Debt

- [x] **Stale Time Configuration (Categories):** ~~There is a missing `staleTime` configuration on the `useCategory` hook in `use-categories.ts:122-135`, which could lead to unnecessary bridge saturation and redundant network requests.~~ **RESOLVED:** S-Tier Volatility Engine implemented in `lib/constants/query.constants.ts`. New `createQueryOptions()` factory with semantic volatility classification (REFERENCE, STRUCTURAL, TRANSACTIONAL). Applied to 20 hooks across all features. iOS-optimized: `gcTime >> staleTime` for instant hydration, `refetchOnWindowFocus: false` prevents bridge saturation on app resume.
- [ ] **Optimistic Update Gaps (Categories):** The `useAddCategory` mutation in `use-category-mutations.ts:59-96` lacks an optimistic update implementation, resulting in a less responsive UI compared to the transactions and accounts features.
- [ ] **Scalability Guardrails (Dashboard):** While current logic is O(n), the financial overview computations lack protection for scenarios where accounts or categories scale significantly beyond 100 items.
- [ ] **Ghost Prop Audit:** Multiple interfaces across features require a final pruning of unused properties ("Ghost Props") to prevent the generation of unnecessary debt in the iOS Swift protocol mapping.

---

## Reliability & Go-Live Readiness

- [ ] **Import Optimization:** Fix timeouts on large Excel/CSV imports



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
