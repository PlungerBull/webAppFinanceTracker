/**
 * Ledger Transaction Modal Content
 *
 * Single-responsibility Content Component for transaction entry mode.
 *
 * CTO MANDATES:
 * - React.memo: Prevents re-renders when user types in hidden TransferModal
 * - NO Dialog: Receives onClose callback, wrapper owns Dialog
 * - DTO Pattern: Converts form data → TransactionRouteInputDTO at boundary
 * - Pure Service: Toast/navigation via onSuccess callback
 *
 * Handles:
 * - Transaction form state management
 * - Validation (UI layer)
 * - Submission via routing service
 *
 * Does NOT handle:
 * - Mode switching (delegated to wrapper)
 * - Dialog state (delegated to wrapper)
 * - Transfer logic (separate component)
 *
 * @module ledger-transaction-modal-content
 */

'use client';

import { memo, useState, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { TransactionForm, type TransactionFormData } from './transaction-form';
import { useTransactionRouting } from '../hooks/use-transaction-routing';
import { useCategoriesData, useAccountsData } from '@/lib/hooks/use-reference-data';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { TransactionRouteInputDTO } from '../domain/types';

/**
 * Props for LedgerTransactionModalContent
 *
 * Content Component receives callbacks from parent wrapper.
 * Does NOT receive Dialog props (wrapper owns Dialog).
 */
interface LedgerTransactionModalContentProps {
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
const INITIAL_FORM_DATA: TransactionFormData = {
  amount: '',
  categoryId: null,
  fromAccountId: null,
  exchangeRate: '',
  date: new Date(),
  payee: '',
  notes: '',
};

/**
 * Convert TransactionFormData → TransactionRouteInputDTO
 *
 * DTO Pattern: Clean data contract at component boundary.
 * NEVER pass raw React form objects to service.
 *
 * CTO MANDATE: Components collect raw input, services sanitize.
 * - NO .trim() here - service layer handles sanitization
 * - Empty strings passed as-is, service converts to null after trimming
 */
function formDataToDTO(data: TransactionFormData): TransactionRouteInputDTO {
  const amountVal = parseFloat(data.amount);
  // SACRED RULE: amountCents: 0 is MISSING (handled by service)
  const amountCents = !isNaN(amountVal) ? Math.round(amountVal * 100) : null;

  return {
    amountCents,
    // Pass raw string - service sanitizes (trim + normalize whitespace)
    description: data.payee || null,
    accountId: data.fromAccountId,
    categoryId: data.categoryId,
    date: format(data.date, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"),
    // Pass raw string - service sanitizes (trim + normalize whitespace)
    notes: data.notes || null,
    exchangeRate: data.exchangeRate ? parseFloat(data.exchangeRate) : null,
  };
}

/**
 * Ledger Transaction Modal Content
 *
 * React.memo'd to prevent re-renders when user types in TransferModal.
 */
export const LedgerTransactionModalContent = memo(function LedgerTransactionModalContent({
  onClose,
}: LedgerTransactionModalContentProps) {
  // Local form state (isolated, resets on unmount)
  const [formData, setFormData] = useState<TransactionFormData>(INITIAL_FORM_DATA);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Data hooks
  const { categories } = useCategoriesData();
  const { accounts: flatAccounts } = useAccountsData();

  // Routing hook with callbacks
  const { submit, determineRoute, isSubmitting } = useTransactionRouting({
    onSuccess: (result) => {
      toast.success(result.route === 'ledger' ? 'Transaction saved' : 'Draft saved to Inbox');
      onClose();
    },
    onError: (error) => {
      console.error('Failed to submit:', error);
      toast.error('Failed to save transaction');
    },
  });

  // Convert form data to DTO and get routing decision
  const dto = useMemo(() => formDataToDTO(formData), [formData]);
  const routingDecision = useMemo(() => determineRoute(dto), [determineRoute, dto]);

  // Form is valid if it has any data (can route to either ledger or inbox)
  const isValid = routingDecision.hasAnyData;

  // Form handler
  const handleChange = useCallback((updates: Partial<TransactionFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    setHasSubmitted(true);
    if (!isValid || isSubmitting) return;

    await submit(dto);
  }, [isValid, isSubmitting, submit, dto]);

  // Dynamic button text based on routing decision
  // isComplete → "Add Transaction" (goes to Ledger)
  // !isComplete → "Save to Inbox" (goes to Inbox)
  const buttonText = routingDecision.isComplete ? 'Add Transaction' : 'Save to Inbox';

  return (
    <>
      {/* Form Content */}
      <TransactionForm
        data={formData}
        onChange={handleChange}
        categories={categories}
        flatAccounts={flatAccounts}
        isSubmitting={isSubmitting}
        hasSubmitted={hasSubmitted}
      />

      {/* Submit Button */}
      <div className="bg-white border-t border-gray-100 p-4 rounded-b-3xl shrink-0">
        <Button
          onClick={handleSubmit}
          disabled={!isValid || isSubmitting}
          className="w-full font-bold py-3 px-6 rounded-xl shadow-lg transition-all bg-gray-900 hover:bg-black text-white"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            buttonText
          )}
        </Button>
      </div>
    </>
  );
});
