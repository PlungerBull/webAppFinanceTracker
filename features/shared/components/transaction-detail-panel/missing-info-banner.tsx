'use client';

import { AlertCircle } from 'lucide-react';
import { getReadinessMessage } from './utils/readiness';
import type { PanelMode, LedgerReadinessState } from './types';

interface MissingInfoBannerProps {
  mode: PanelMode;
  ledgerReadiness: LedgerReadinessState;
}

export function MissingInfoBanner({ mode, ledgerReadiness }: MissingInfoBannerProps) {
  // Show in inbox when incomplete (orange warning - draft-friendly)
  if (mode === 'inbox' && !ledgerReadiness.isReady) {
    return (
      <div className="mx-6 mb-4 p-4 rounded-xl border bg-[#FFF9F2] border-[#FEE7D2]">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-[#FF843D]" />
          <div>
            <p className="text-[11px] font-bold leading-relaxed text-[#7C2D12]">
              Save as Draft
            </p>
            <p className="text-[10px] leading-relaxed text-[#9A3412]">
              {getReadinessMessage(ledgerReadiness)}. You can save your progress and complete later.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // SACRED LEDGER ENFORCEMENT: Show in transaction mode when incomplete (red error)
  if (mode === 'transaction' && !ledgerReadiness.isReady) {
    return (
      <div className="mx-6 mb-4 p-4 rounded-xl border bg-red-50 border-red-200">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
          <div>
            <p className="text-[11px] font-bold leading-relaxed text-red-900">
              Cannot Save Incomplete Transaction
            </p>
            <p className="text-[10px] leading-relaxed text-red-700">
              {getReadinessMessage(ledgerReadiness)}. Ledger transactions must be complete.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
