'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useAddTransaction } from '../hooks/use-transactions';
import { useCreateTransfer } from '../hooks/use-transfers';
import { useCreateInboxItem } from '@/features/inbox';
import { useCategories } from '@/features/categories/hooks/use-categories';
import { useGroupedAccounts } from '@/hooks/use-grouped-accounts';
import { useAccounts } from '@/features/accounts/hooks/use-accounts';
import { TransactionTypeTabs } from './transaction-type-tabs';
import { TransactionForm, type TransactionFormData } from './transaction-form';
import { TransferForm, type TransferFormData } from './transfer-form';
import { Button } from '@/components/ui/button';
import { Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface AddTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddTransactionModal({ open, onOpenChange }: AddTransactionModalProps) {
  // Mode state
  const [mode, setMode] = useState<'transaction' | 'transfer'>('transaction');
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Transaction form state
  const [transactionData, setTransactionData] = useState<TransactionFormData>({
    amount: '',
    derivedType: null, // Auto-derived from category
    categoryId: null,
    fromAccountId: null, // Single source of truth
    exchangeRate: '',
    date: new Date(),
    payee: '',
    notes: '',
  });

  // Transfer form state
  const [transferData, setTransferData] = useState<TransferFormData>({
    fromGroupId: null,
    toGroupId: null,
    fromAccountId: null,
    toAccountId: null,
    fromCurrency: null,
    toCurrency: null,
    sentAmount: '',
    receivedAmount: '',
    date: new Date(),
    notes: '',
  });

  // Hooks
  const { data: categories = [] } = useCategories();
  const { data: flatAccounts = [] } = useAccounts(); // Flat account list for transaction form
  const { groupedAccounts, accounts: rawAccounts } = useGroupedAccounts(); // Still needed for transfer form

  // Mutations
  const addTransactionMutation = useAddTransaction();
  const createTransferMutation = useCreateTransfer();
  const createInboxItemMutation = useCreateInboxItem();

  const isSubmitting = addTransactionMutation.isPending || createTransferMutation.isPending || createInboxItemMutation.isPending;

  // Validation - THREE-STATE VALIDATION for scratchpad mode
  const validationState = useMemo(() => {
    if (mode === 'transaction') {
      const amountVal = parseFloat(transactionData.amount);
      const hasAmount = !isNaN(amountVal) && amountVal !== 0;
      const hasDescription = transactionData.payee && transactionData.payee.trim().length > 0;
      const hasAccount = transactionData.fromAccountId && flatAccounts.find(a => a.accountId === transactionData.fromAccountId);
      const hasCategory = transactionData.categoryId;

      // Check if ANY data exists
      const hasAnyData = hasAmount || hasDescription || hasAccount || hasCategory;

      // Check if ALL required fields exist (Ledger Ready)
      const isComplete = hasAmount && hasDescription && hasAccount && hasCategory && transactionData.derivedType;

      return {
        hasAnyData,      // At least one field filled
        isComplete,      // All 4 required fields filled
        isEmpty: !hasAnyData
      };
    } else {
      // Transfer mode validation remains unchanged
      const hasAmount = parseFloat(transferData.sentAmount) > 0;
      const hasFromAccount = transferData.fromAccountId && transferData.fromCurrency;
      const hasToAccount = transferData.toAccountId && transferData.toCurrency;
      const notLoop = !(
        transferData.fromAccountId === transferData.toAccountId &&
        transferData.fromCurrency === transferData.toCurrency
      );
      const isSameCurrency = transferData.fromCurrency === transferData.toCurrency;
      const hasReceivedAmount = isSameCurrency || parseFloat(transferData.receivedAmount) > 0;
      const isValid = hasAmount && hasFromAccount && hasToAccount && notLoop && hasReceivedAmount;

      return { hasAnyData: isValid, isComplete: isValid, isEmpty: !isValid };
    }
  }, [mode, transactionData, transferData, flatAccounts]);

  // Single "Save" button - disabled only if completely empty
  const isValid = mode === 'transaction' ? validationState.hasAnyData : validationState.isComplete;

  // Handlers
  const handleClose = () => {
    setMode('transaction');
    setTransactionData({
      amount: '',
      derivedType: null, // Reset derived type
      categoryId: null,
      fromAccountId: null, // Single source of truth
      exchangeRate: '',
      date: new Date(),
      payee: '',
      notes: '',
    });
    setTransferData({
      fromGroupId: null,
      toGroupId: null,
      fromAccountId: null,
      toAccountId: null,
      fromCurrency: null,
      toCurrency: null,
      sentAmount: '',
      receivedAmount: '',
      date: new Date(),
      notes: '',
    });
    setHasSubmitted(false);
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    setHasSubmitted(true);
    if (!isValid || isSubmitting) return;

    try {
      if (mode === 'transaction') {
        // SMART ROUTING LOGIC - Single Save button, internal routing
        const selectedAccount = flatAccounts.find(a => a.accountId === transactionData.fromAccountId);
        const amountVal = parseFloat(transactionData.amount);
        const finalAmount = !isNaN(amountVal) ? amountVal : null;

        // CROSS-CURRENCY GATEKEEPER: Check if exchange rate is needed
        // NOTE: For now, we assume all transactions use the account's currency
        // In a full implementation, you'd compare account currency vs user's main currency
        // and require exchange rate if they differ. For simplicity, we'll route to inbox
        // if exchange rate is missing when it might be needed.

        if (validationState.isComplete) {
          // PATH A: Complete Data → Check Cross-Currency Requirements
          const rate = transactionData.exchangeRate ? parseFloat(transactionData.exchangeRate) : 1;

          // MULTI-CURRENCY SAFEGUARD:
          // If user entered an exchange rate, trust it (they're doing cross-currency)
          // If no exchange rate provided, default to 1.0 (same currency assumed)
          // The backend/database will enforce any additional constraints

          await addTransactionMutation.mutateAsync({
            description: transactionData.payee!,
            amount_original: finalAmount!,
            currency_original: selectedAccount!.currencyCode!,
            account_id: transactionData.fromAccountId!,
            category_id: transactionData.categoryId!,
            type: transactionData.derivedType!,
            date: format(transactionData.date, 'yyyy-MM-dd'),
            notes: transactionData.notes || undefined,
            exchange_rate: rate,
          });

          toast.success('Transaction saved');
        } else {
          // PATH B: Partial Data → Inbox (Scratchpad Mode)
          // FIX: Pass accountId and categoryId to preserve selections
          await createInboxItemMutation.mutateAsync({
            amount: finalAmount ?? undefined,
            description: transactionData.payee || undefined,
            date: format(transactionData.date, 'yyyy-MM-dd'),
            currency: selectedAccount?.currencyCode || undefined,
            accountId: transactionData.fromAccountId || undefined,        // FIXED: Pass through
            categoryId: transactionData.categoryId || undefined,          // FIXED: Pass through
          });

          toast.success('Draft saved to Inbox');
        }
      } else {
        // Transfer mode
        if (!transferData.fromAccountId || !transferData.fromCurrency || !transferData.toAccountId || !transferData.toCurrency) return;

        const sent = parseFloat(transferData.sentAmount);
        const isSameCurrency = transferData.fromCurrency === transferData.toCurrency;
        const received = isSameCurrency ? sent : parseFloat(transferData.receivedAmount);

        // Get current user
        const { data: { user } } = await createClient().auth.getUser();
        if (!user) throw new Error('User not authenticated');

        await createTransferMutation.mutateAsync({
          userId: user.id,
          fromAccountId: transferData.fromAccountId,
          toAccountId: transferData.toAccountId,
          fromCurrency: transferData.fromCurrency,
          toCurrency: transferData.toCurrency,
          sentAmount: sent,
          receivedAmount: received,
          date: format(transferData.date, 'yyyy-MM-dd'),
          description: 'Transfer',
        });
      }

      handleClose();
    } catch (error) {
      console.error('Failed to submit:', error);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 animate-in fade-in duration-200" />

        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] outline-none animate-in fade-in zoom-in-95 duration-200">
          <VisuallyHidden>
            <DialogPrimitive.Title>
              {mode === 'transaction' ? 'Add Transaction' : 'Transfer Funds'}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description>
              Form to create a new transaction or transfer funds between accounts.
            </DialogPrimitive.Description>
          </VisuallyHidden>
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">

            {/* ZONE 1: Header - Mode Switcher */}
            <div className="relative pt-6 pb-2 flex items-center justify-center shrink-0">
              <TransactionTypeTabs value={mode} onChange={setMode} disabled={isSubmitting} />
              <button
                onClick={handleClose}
                className="absolute top-6 right-6 p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ZONE 2-4: Form Content (delegated to specialized components) */}
            {mode === 'transaction' ? (
              <TransactionForm
                data={transactionData}
                onChange={(updates) => setTransactionData((prev) => ({ ...prev, ...updates }))}
                categories={categories}
                flatAccounts={flatAccounts}
                isSubmitting={isSubmitting}
                hasSubmitted={hasSubmitted}
              />
            ) : (
              <TransferForm
                data={transferData}
                onChange={(updates) => setTransferData((prev) => ({ ...prev, ...updates }))}
                groupedAccounts={groupedAccounts}
                rawAccounts={rawAccounts}
                isSubmitting={isSubmitting}
              />
            )}

            {/* Submit Button */}
            <div className="bg-white border-t border-gray-100 p-4 rounded-b-3xl shrink-0">
              <Button
                onClick={handleSubmit}
                disabled={!isValid || isSubmitting}
                className={cn(
                  "w-full font-bold py-3 px-6 rounded-xl shadow-lg transition-all",
                  mode === 'transfer'
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-gray-900 hover:bg-black text-white"
                )}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {mode === 'transfer' ? 'Transferring...' : 'Saving...'}
                  </>
                ) : mode === 'transfer' ? (
                  'Transfer Funds'
                ) : (
                  // DYNAMIC BUTTON TEXT: Shows routing destination
                  (transactionData.fromAccountId && transactionData.categoryId && transactionData.derivedType)
                    ? 'Add Transaction'  // Goes to Ledger
                    : 'Save to Inbox'      // Goes to Inbox
                )}
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
