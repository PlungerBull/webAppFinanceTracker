'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, Check, FileCheck, FileClock } from 'lucide-react';
import {
  useReconciliations,
  useDeleteReconciliation,
  useUpdateReconciliation,
} from '@/features/reconciliations/hooks/use-reconciliations';
import { useAccounts } from '@/features/accounts/hooks/use-accounts';
import { ReconciliationFormModal } from './reconciliation-form-modal';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export function ReconciliationSettings() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingReconciliation, setEditingReconciliation] = useState<string | null>(null);

  const { data: reconciliations = [], isLoading } = useReconciliations();
  const { data: accounts = [] } = useAccounts();
  const deleteMutation = useDeleteReconciliation();
  const updateMutation = useUpdateReconciliation();

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this reconciliation? Linked transactions will be unlinked.')) return;
    await deleteMutation.mutateAsync(id);
  };

  const handleToggleStatus = async (id: string, currentStatus: 'draft' | 'completed') => {
    const newStatus = currentStatus === 'draft' ? 'completed' : 'draft';
    const message =
      newStatus === 'completed'
        ? 'Complete this reconciliation? Linked transactions will become locked (amount/date/account immutable).'
        : 'Revert to draft? Linked transactions will become editable again.';

    if (!confirm(message)) return;

    await updateMutation.mutateAsync({
      id,
      updates: { status: newStatus },
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-zinc-100 dark:border-zinc-800 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold mb-1">Reconciliations</h3>
            <p className="text-sm text-muted-foreground">
              Define the "Contract of Truth" between bank statements and your ledger
            </p>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Reconciliation
          </Button>
        </div>
      </div>

      {/* Reconciliations List */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-8">Loading...</div>
      ) : reconciliations.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          No reconciliations yet. Create one to start tracking account balances.
        </div>
      ) : (
        <div className="space-y-3">
          {reconciliations.map((reconciliation) => {
            const account = accounts.find((a) => a.accountId === reconciliation.accountId);

            return (
              <div
                key={reconciliation.id}
                className="flex items-center justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
              >
                {/* Left: Info */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{reconciliation.name}</span>
                    <Badge
                      variant={reconciliation.status === 'completed' ? 'default' : 'secondary'}
                      className={cn(
                        'text-xs',
                        reconciliation.status === 'completed' &&
                          'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                      )}
                    >
                      {reconciliation.status === 'completed' ? (
                        <>
                          <FileCheck className="w-3 h-3 mr-1" /> Completed
                        </>
                      ) : (
                        <>
                          <FileClock className="w-3 h-3 mr-1" /> Draft
                        </>
                      )}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {account?.name || 'Unknown Account'} •{' '}
                    Beginning: {reconciliation.beginningBalance.toFixed(2)} →
                    Ending: {reconciliation.endingBalance.toFixed(2)}
                  </div>
                  {reconciliation.dateStart && reconciliation.dateEnd && (
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(reconciliation.dateStart), 'MMM dd, yyyy')} -{' '}
                      {format(new Date(reconciliation.dateEnd), 'MMM dd, yyyy')}
                    </div>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleStatus(reconciliation.id, reconciliation.status)}
                  >
                    {reconciliation.status === 'draft' ? (
                      <>
                        <Check className="w-4 h-4 mr-1" /> Complete
                      </>
                    ) : (
                      <>Revert to Draft</>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingReconciliation(reconciliation.id)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(reconciliation.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <ReconciliationFormModal
        open={isCreateModalOpen || !!editingReconciliation}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateModalOpen(false);
            setEditingReconciliation(null);
          }
        }}
        reconciliationId={editingReconciliation}
      />
    </div>
  );
}
