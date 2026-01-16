'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, ShieldCheck, Clock, CheckCircle2, ArrowRight, DollarSign } from 'lucide-react';
import {
  useReconciliations,
  useDeleteReconciliation,
  useUpdateReconciliation,
} from '@/features/reconciliations/hooks/use-reconciliations';
import { useAccounts } from '@/features/accounts/hooks/use-accounts';
import { ReconciliationFormModal } from './reconciliation-form-modal';
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
    if (!confirm('Delete this audit? Linked transactions will be unlinked.')) return;
    await deleteMutation.mutateAsync(id);
  };

  const handleFinalize = async (id: string) => {
    if (!confirm('Finalize & Lock this audit? Linked transactions will become immutable (amount/date/account cannot be changed).')) return;

    await updateMutation.mutateAsync({
      id,
      updates: { status: 'completed' },
    });
  };

  const handleRevert = async (id: string) => {
    if (!confirm('Revert to draft? Linked transactions will become editable again.')) return;

    await updateMutation.mutateAsync({
      id,
      updates: { status: 'draft' },
    });
  };

  const handleResumeAudit = (reconciliationId: string) => {
    // TODO: Navigate to transactions view with this reconciliation active
    // This will be implemented when we wire up the view switching
    console.log('Resume audit:', reconciliationId);
  };

  return (
    <div className="space-y-8">
      {/* The Header: Bold & Authoritative */}
      <div className="mb-12">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-2">
                Reconciliations
              </h1>
              <p className="text-sm text-gray-500">
                The "Contract of Truth" between bank statements and your ledger
              </p>
            </div>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-200 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Audit
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center text-gray-400 py-16">
            <div className="animate-pulse">Loading audits...</div>
          </div>
        )}

        {/* Empty State: "Welcome to Auditing" */}
        {!isLoading && reconciliations.length === 0 && (
          <div className="animate-in fade-in">
            <div className="border-2 border-dashed border-gray-100 rounded-2xl p-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 mb-4">
                <ShieldCheck className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Welcome to Auditing
              </h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                Create your first audit to establish the formal "Contract of Truth" between your bank statements and transaction ledger.
              </p>
            </div>
          </div>
        )}

        {/* The Audit Cards: Card-on-Canvas Layout */}
        {!isLoading && reconciliations.length > 0 && (
          <div className="space-y-4 animate-in fade-in">
            {reconciliations.map((reconciliation) => {
              const account = accounts.find((a) => a.id === reconciliation.accountId);
              const isDraft = reconciliation.status === 'draft';

              return (
                <div
                  key={reconciliation.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="p-6">
                    {/* A. Status & Metadata Zone */}
                    <div className="flex items-start gap-4 mb-6">
                      {/* Iconic Representation */}
                      <div
                        className={cn(
                          'p-2.5 rounded-xl shrink-0',
                          isDraft
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-emerald-50 text-emerald-600'
                        )}
                      >
                        {isDraft ? (
                          <Clock className="w-6 h-6" />
                        ) : (
                          <CheckCircle2 className="w-6 h-6" />
                        )}
                      </div>

                      {/* Identification */}
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900 mb-1">
                          {reconciliation.name}
                        </h3>
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-gray-400">
                          <span>{account?.name || 'Unknown Account'}</span>
                          {reconciliation.dateStart && reconciliation.dateEnd && (
                            <>
                              <span>•</span>
                              <span>
                                {format(new Date(reconciliation.dateStart), 'MMM dd')} -{' '}
                                {format(new Date(reconciliation.dateEnd), 'MMM dd, yyyy')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div
                        className={cn(
                          'px-3 py-1 rounded-full text-xs font-medium',
                          isDraft
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-emerald-50 text-emerald-700'
                        )}
                      >
                        {isDraft ? 'Draft' : 'Locked'}
                      </div>
                    </div>

                    {/* B. The Balance Grid (The Comparison) */}
                    <div className="grid grid-cols-2 gap-6 py-4 border-y border-gray-50 mb-4">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">
                          Starting Balance
                        </div>
                        <div className="flex items-baseline gap-1">
                          <DollarSign className="w-4 h-4 text-gray-400" />
                          <span className="text-xl font-mono font-bold text-gray-900">
                            {reconciliation.beginningBalance.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">
                          Target Statement Balance
                        </div>
                        <div className="flex items-baseline gap-1">
                          <DollarSign className="w-4 h-4 text-gray-400" />
                          <span className="text-xl font-mono font-bold text-gray-900">
                            {reconciliation.endingBalance.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* C. The Action Footer */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(reconciliation.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                          title="Delete audit"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Finalize / Revert */}
                        {isDraft ? (
                          <button
                            onClick={() => handleFinalize(reconciliation.id)}
                            className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
                          >
                            Finalize & Lock
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRevert(reconciliation.id)}
                            className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                          >
                            Revert to Draft
                          </button>
                        )}

                        {/* Resume/View - The Magic Bridge */}
                        <Button
                          onClick={() => handleResumeAudit(reconciliation.id)}
                          className="bg-gray-50 hover:bg-gray-100 text-gray-900 shadow-none active:scale-95 transition-all"
                        >
                          {isDraft ? 'Resume Audit' : 'View Audit'}
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    </div>
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
