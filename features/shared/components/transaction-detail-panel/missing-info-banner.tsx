'use client';

import { AlertCircle } from 'lucide-react';
import type { PanelMode, EditedFields, PanelData } from './types';

interface MissingInfoBannerProps {
  mode: PanelMode;
  data: PanelData;
  editedFields: EditedFields;
}

export function MissingInfoBanner({ mode, data, editedFields }: MissingInfoBannerProps) {
  // Only show in inbox mode
  if (mode !== 'inbox') return null;

  const selectedAccountId = editedFields.accountId ?? data.accountId;
  const selectedCategoryId = editedFields.categoryId ?? data.categoryId;

  // Determine what's missing
  const missingAccount = !selectedAccountId;
  const missingCategory = !selectedCategoryId;

  // Don't show if nothing is missing
  if (!missingAccount && !missingCategory) return null;

  // Build message based on what's missing
  let message = '';
  if (missingAccount && missingCategory) {
    message = 'Assign a bank account and category before promoting this transaction to your ledger.';
  } else if (missingAccount) {
    message = 'Assign a bank account before promoting this transaction to your ledger.';
  } else if (missingCategory) {
    message = 'Assign a category before promoting this transaction to your ledger.';
  }

  return (
    <div className="mx-6 mb-4 p-4 bg-orange-50 border border-orange-100 rounded-xl">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-orange-700">Missing Information</p>
          <p className="text-sm text-orange-600 mt-1">{message}</p>
        </div>
      </div>
    </div>
  );
}
