We are building an app for expense management, inspired by todoist

Right now we are performing some management of the code.

Tasks:
1. Centralize hard-coded values
    1.1 We left it on the add-category-modal file on schemas on auth on features
2. Find duplicate functions
    2.1 The delete/edit/create modals for categories, bank accounts, are likely candidates.



Refactor Plan: DRY Violations & Modularity Improvements
Phase 1: Create Shared Foundation (Priority 1 - High Impact, Low Effort)
1.1 Create shared hooks (4 hours total)
Create hooks/shared/use-form-modal.ts - Generic form modal state management
Create hooks/shared/use-delete-item.ts - Standardized delete operations
Create hooks/shared/use-query-invalidation.ts - Centralize query cache invalidation
Create hooks/use-grouped-accounts.ts - Extract account grouping logic
1.2 Create ColorPicker component (2 hours)
Create components/shared/color-picker.tsx
Update account-form.tsx to use ColorPicker (reduce from 139→70 lines)
Update category-form.tsx to use ColorPicker (reduce from 116→50 lines)
1.3 Centralize validation schemas (1 hour)
Create features/shared/schemas/entity.schema.ts
Remove inline schemas from all 5 modals
Ensure all modals import centralized schemas
Impact: ~350 lines reduced, standardized form/delete patterns
Phase 2: Generic Modal & Dialog Components (Priority 2 - High Impact)
2.1 Create FormModal component (6 hours)
Create components/shared/form-modal.tsx - Generic CRUD modal
Update 5 modals to use FormModal:
add-account-modal.tsx (341→100 lines)
edit-account-modal.tsx (305→80 lines)
add-category-modal.tsx (122→40 lines)
edit-category-modal.tsx (145→40 lines)
add-transaction-modal.tsx (276→120 lines)
2.2 Create DeleteDialog component (2 hours)
Create components/shared/delete-dialog.tsx
Update delete-account-dialog.tsx (100→20 lines)
Update delete-category-dialog.tsx (98→20 lines)
Impact: ~1200 lines reduced, 67% reduction in modal code
Phase 3: Split Large Components (Priority 2-3 - Medium Impact)
3.1 Break down Settings Page (4 hours)
Split app/settings/page.tsx (472 lines) into:
page.tsx (main layout, ~50 lines)
components/settings-sidebar.tsx
components/account-settings/profile-form.tsx
components/account-settings/security-cards.tsx
components/data-settings/import-export-card.tsx
components/data-settings/danger-zone-card.tsx
hooks/use-profile-update.ts
hooks/use-data-import.ts
hooks/use-data-clear.ts
3.2 Refactor Transaction Detail Panel (6 hours)
Split transaction-detail-panel.tsx (445 lines) into:
index.tsx (main layout, ~100 lines)
transaction-header.tsx
transaction-metadata.tsx
transaction-notes-section.tsx
hooks/use-transaction-editor.ts
Create reusable components/shared/editable-field.tsx
3.3 Simplify Account List (2 hours)
Extract to hooks/use-grouped-accounts.ts
Extract to hooks/use-account-navigation.ts
Create AccountListItem.tsx sub-component
Impact: 3 monolithic files → 20 focused, testable components
Total Estimated Impact
Time: ~27 hours total
Line Reduction: ~2000 lines (35% reduction)
New Shared Components: 5 (FormModal, DeleteDialog, ColorPicker, EditableField, LoadingButton)
New Shared Hooks: 7
Files Refactored: 15 files
Code Duplication Eliminated: 6 major patterns
Execution Order
Phase 1 (7 hours) - Foundation, no breaking changes
Phase 2 (8 hours) - High impact, requires modal updates
Phase 3 (12 hours) - Component splitting, improves maintainability


Testing