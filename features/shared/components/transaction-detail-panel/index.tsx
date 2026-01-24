'use client';

import { useState, useEffect } from 'react';
import { IdentityHeader } from './identity-header';
import { FormSection } from './form-section';
import { MissingInfoBanner } from './missing-info-banner';
import { ActionFooter } from './action-footer';
import { calculateLedgerReadiness } from './utils/readiness';
import { useCurrency } from '@/contexts/currency-context';
import { useUserSettings } from '@/features/settings/hooks/use-user-settings';
import type { TransactionDetailPanelProps, EditedFields } from './types';


export function TransactionDetailPanel(props: TransactionDetailPanelProps) {
  const {
    mode,
    data,
    accounts,
    categories,
    onDelete,
    onClose,
    isLoading = false,
  } = props;

  // Local state for pending edits
  const [editedFields, setEditedFields] = useState<EditedFields>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Access main currency and check if settings are still loading
  const { mainCurrency } = useCurrency();  // May be default USD during load
  const { isLoading: isSettingsLoading } = useUserSettings();  // Check if still loading

  // CRITICAL: Treat as loading if settings not yet resolved
  // Prevents user from saving with wrong currency assumption
  const isSettingsReady = !isSettingsLoading;

  // Track unsaved changes
  useEffect(() => {
    const hasChanges = Object.keys(editedFields).length > 0;
    setHasUnsavedChanges(hasChanges);
  }, [editedFields]);

  // Reset edited fields when switching to a different transaction/item
  useEffect(() => {
    setEditedFields({});
  }, [data?.id]);

  // Update a single field
  const handleFieldChange = (field: keyof EditedFields, value: string | number | undefined) => {
    setEditedFields((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Calculate ledger readiness (for BOTH modes)
  // Inbox: uses for routing between draft/promote
  // Transaction: uses for validation enforcement
  // CRITICAL: Only calculate when settings loaded to avoid wrong currency comparison
  const ledgerReadiness = isSettingsReady
    ? calculateLedgerReadiness(data, editedFields, accounts, mainCurrency)
    : { isReady: false, canSaveDraft: false, missingFields: [] };

  // Handle save with Smart Save routing
  const handleSave = async () => {
    // Safety check: Don't save if settings still loading
    if (!isSettingsReady) return;

    if (props.mode === 'inbox') {
      // SMART SAVE ROUTING
      if (ledgerReadiness.isReady) {
        // All fields complete → Promote to ledger
        await props.onPromote(editedFields);
      } else if (ledgerReadiness.canSaveDraft) {
        // Partial data → Save as draft
        await props.onPartialSave(editedFields);
      }
      // If nothing edited, do nothing (button should be disabled)
    } else {
      // TRANSACTION MODE: Use legacy save
      await props.onSave(editedFields);
    }
    // Clear edited fields after successful save
    setEditedFields({});
  };

  // Handle delete with confirmation
  const handleDelete = async () => {
    const confirmMessage = mode === 'inbox'
      ? 'Are you sure you want to delete this draft transaction?'
      : 'Are you sure you want to delete this transaction? This action cannot be undone.';

    if (!confirm(confirmMessage)) return;

    await onDelete();
  };

  // Warn on page unload if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Determine category type for amount coloring (transaction mode only)
  const selectedCategoryId = editedFields.categoryId ?? data.categoryId;
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const categoryType = selectedCategory?.type;

  // Check if promotion is possible (inbox mode only)
  const selectedAccountId = editedFields.accountId ?? data.accountId;
  const canPromote = mode === 'inbox' && !!selectedAccountId && !!selectedCategoryId;

  return (
    <div className="h-full w-[400px] bg-white border-l border-gray-200 flex flex-col">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Identity Header */}
        <IdentityHeader
          mode={mode}
          data={data}
          editedFields={editedFields}
          onFieldChange={handleFieldChange}
          categoryType={categoryType}
          accounts={accounts}
        />

        {/* Form Section */}
        <FormSection
          mode={mode}
          data={data}
          editedFields={editedFields}
          onFieldChange={handleFieldChange}
          accounts={accounts}
          categories={categories}
        />

        {/* Missing Info Banner (shows in both modes when incomplete) */}
        <MissingInfoBanner mode={mode} ledgerReadiness={ledgerReadiness} />
      </div>

      {/* Action Footer (Pinned) */}
      <ActionFooter
        mode={mode}
        onSave={handleSave}
        onDelete={handleDelete}
        hasUnsavedChanges={hasUnsavedChanges}
        canPromote={canPromote}  // Legacy fallback
        ledgerReadiness={ledgerReadiness}  // NEW: Rich readiness state
        isLoading={isLoading || !isSettingsReady}  // Disable button during settings load
      />
    </div>
  );
}

// Export sub-components for direct use if needed
export { IdentityHeader } from './identity-header';
export { FormSection } from './form-section';
export { MissingInfoBanner } from './missing-info-banner';
export { ActionFooter } from './action-footer';

// Export types
export type * from './types';
