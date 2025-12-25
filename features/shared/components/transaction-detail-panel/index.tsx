'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IdentityHeader } from './identity-header';
import { FormSection } from './form-section';
import { MissingInfoBanner } from './missing-info-banner';
import { ActionFooter } from './action-footer';
import type { TransactionDetailPanelProps, EditedFields } from './types';

export function TransactionDetailPanel({
  mode,
  data,
  accounts,
  categories,
  onSave,
  onDelete,
  onClose,
  isLoading = false,
}: TransactionDetailPanelProps) {
  // Local state for pending edits
  const [editedFields, setEditedFields] = useState<EditedFields>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Track unsaved changes
  useEffect(() => {
    const hasChanges = Object.keys(editedFields).length > 0;
    setHasUnsavedChanges(hasChanges);
  }, [editedFields]);

  // Update a single field
  const handleFieldChange = (field: keyof EditedFields, value: string | number) => {
    setEditedFields((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Handle save
  const handleSave = async () => {
    await onSave(editedFields);
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

  // Handle close with unsaved changes warning
  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Are you sure you want to close?')) {
        return;
      }
    }
    onClose();
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
      {/* Header with close button */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">
          {mode === 'inbox' ? 'Review Transaction' : 'Edit Transaction'}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClose}
          className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Identity Header */}
        <IdentityHeader
          mode={mode}
          data={data}
          editedFields={editedFields}
          onFieldChange={handleFieldChange}
          categoryType={categoryType}
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

        {/* Missing Info Banner (Inbox only) */}
        <MissingInfoBanner mode={mode} data={data} editedFields={editedFields} />
      </div>

      {/* Action Footer (Pinned) */}
      <ActionFooter
        mode={mode}
        onSave={handleSave}
        onDelete={handleDelete}
        hasUnsavedChanges={hasUnsavedChanges}
        canPromote={canPromote}
        isLoading={isLoading}
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
