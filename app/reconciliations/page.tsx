'use client';

import { ReconciliationSettings } from '@/features/settings/components/reconciliation-settings';

export default function ReconciliationsPage() {
  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-5xl mx-auto py-12 px-8">
        <ReconciliationSettings />
      </div>
    </div>
  );
}
