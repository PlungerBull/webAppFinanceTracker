/**
 * Transfer Modal Content
 *
 * Single-responsibility Content Component for internal transfers.
 *
 * CTO MANDATES:
 * - React.memo: Prevents re-renders when user types in hidden LedgerTransactionModal
 * - NO Dialog: Receives onClose callback, wrapper owns Dialog
 * - No Smart Routing: Transfers always go to Ledger (both IN and OUT transactions)
 *
 * Handles:
 * - Transfer form state management
 * - Cross-currency validation
 * - Submission via TransferService
 *
 * Does NOT handle:
 * - Mode switching (delegated to wrapper)
 * - Dialog state (delegated to wrapper)
 * - Ledger transaction logic (separate component)
 *
 * @module transfer-modal-content
 */

'use client';

import { memo, useState, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { TransferForm, type TransferFormData } from './transfer-form';
import { useCreateTransfer } from '../hooks/use-transfers';
import { useGroupedAccounts } from '@/lib/hooks/use-grouped-accounts';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

/**
 * Props for TransferModalContent
 *
 * Content Component receives callbacks from parent wrapper.
 * Does NOT receive Dialog props (wrapper owns Dialog).
 */
interface TransferModalContentProps {
  /**
   * Called when modal should close (after successful submission)
   */
  onClose: () => void;
}

/**
 * Initial form state
 *
 * State resets naturally when component unmounts (tab switch).
 * CTO Mandate: No state sync between modes.
 */
const INITIAL_FORM_DATA: TransferFormData = {
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
};

/**
 * Transfer Modal Content
 *
 * React.memo'd to prevent re-renders when user types in LedgerTransactionModal.
 */
export const TransferModalContent = memo(function TransferModalContent({
  onClose,
}: TransferModalContentProps) {
  // Local form state (isolated, resets on unmount)
  const [formData, setFormData] = useState<TransferFormData>(INITIAL_FORM_DATA);

  // Data hooks
  const { groupedAccounts, accounts: rawAccounts } = useGroupedAccounts();

  // Transfer mutation (existing hook)
  const createTransferMutation = useCreateTransfer();

  const isSubmitting = createTransferMutation.isPending;

  // Validation state
  const validationState = useMemo(() => {
    const hasAmount = parseFloat(formData.sentAmount) > 0;
    const hasFromAccount = formData.fromAccountId && formData.fromCurrency;
    const hasToAccount = formData.toAccountId && formData.toCurrency;

    // Prevent loop transfer (same account + same currency)
    const notLoop = !(
      formData.fromAccountId === formData.toAccountId &&
      formData.fromCurrency === formData.toCurrency
    );

    const isSameCurrency = formData.fromCurrency === formData.toCurrency;

    // For same-currency, received amount mirrors sent amount
    // For different currency, user must enter received amount
    const hasReceivedAmount = isSameCurrency || parseFloat(formData.receivedAmount) > 0;

    return {
      isValid: !!(hasAmount && hasFromAccount && hasToAccount && notLoop && hasReceivedAmount),
      isSameCurrency,
      isLoopTransfer: !notLoop,
    };
  }, [formData]);

  // Form handler
  const handleChange = useCallback((updates: Partial<TransferFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    if (!validationState.isValid || isSubmitting) return;

    try {
      const sent = parseFloat(formData.sentAmount);
      const received = validationState.isSameCurrency
        ? sent
        : parseFloat(formData.receivedAmount);

      await createTransferMutation.mutateAsync({
        fromAccountId: formData.fromAccountId!,
        toAccountId: formData.toAccountId!,
        sentAmountCents: Math.round(sent * 100),
        receivedAmountCents: Math.round(received * 100),
        date: format(formData.date, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"),
        description: 'Transfer',
      });

      toast.success('Transfer completed');
      onClose();
    } catch (error) {
      console.error('Failed to transfer:', error);
      toast.error('Transfer failed');
    }
  }, [validationState, isSubmitting, formData, createTransferMutation, onClose]);

  return (
    <>
      {/* Form Content */}
      <TransferForm
        data={formData}
        onChange={handleChange}
        groupedAccounts={groupedAccounts}
        rawAccounts={rawAccounts}
        isSubmitting={isSubmitting}
      />

      {/* Submit Button */}
      <div className="bg-white border-t border-gray-100 p-4 rounded-b-3xl shrink-0">
        <Button
          onClick={handleSubmit}
          disabled={!validationState.isValid || isSubmitting}
          className="w-full font-bold py-3 px-6 rounded-xl shadow-lg transition-all bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Transferring...
            </>
          ) : (
            'Transfer Funds'
          )}
        </Button>
      </div>
    </>
  );
});
