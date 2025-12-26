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
    message = 'Please assign a bank account and category before promoting.';
  } else if (missingAccount) {
    message = 'Please assign a bank account before promoting.';
  } else if (missingCategory) {
    message = 'Please assign a category before promoting.';
  }

  return (
    <div className="mx-6 mb-4 p-4 rounded-xl border" style={{ backgroundColor: '#FFF9F2', borderColor: '#FEE7D2' }}>
      <div className="flex items-start gap-3">
        <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#FF843D' }} />
        <div>
          <p className="text-[11px] font-bold leading-relaxed" style={{ color: '#7C2D12' }}>Action Required</p>
          <p className="text-[10px] leading-relaxed" style={{ color: '#9A3412' }}>{message}</p>
        </div>
      </div>
    </div>
  );
}
