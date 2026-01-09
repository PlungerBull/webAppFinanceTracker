'use client';

import { ReconciliationSettings } from '@/features/settings/components/reconciliation-settings';

export default function ReconciliationsPage() {
  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-5xl mx-auto">
        <ReconciliationSettings />
      </div>
    </div>
  );
}
