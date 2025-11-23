import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

/**
 * Field types that can be edited in transaction detail panel
 */
export type EditingField = 'description' | 'amount' | 'date' | 'category_id' | 'account_id' | 'notes' | null;

/**
 * Type for the value being edited
 */
export type TransactionValue = string | number | null;

/**
 * Hook for managing inline transaction editing
 * Extracts editing logic from transaction-detail-panel.tsx
 *
 * @param accountId - Account ID for query invalidation
 * @returns Editor state and handlers
 *
 * @example
 * ```tsx
 * const {
 *   editingField,
 *   editedValue,
 *   startEdit,
 *   cancelEdit,
 *   saveEdit,
 *   isUpdating,
 * } = useTransactionEditor('account-123');
 *
 * // Start editing
 * <Button onClick={() => startEdit('description', transaction.description)}>
 *   Edit
 * </Button>
 *
 * // Save edit
 * <Button onClick={() => saveEdit('description', editedValue)}>
 *   Save
 * </Button>
 * ```
 */
export function useTransactionEditor(accountId?: string | null) {
  const queryClient = useQueryClient();
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [editedValue, setEditedValue] = useState<TransactionValue>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  /**
   * Mutation for updating transaction fields
   */
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      field,
      value,
    }: {
      id: string;
      field: string;
      value: TransactionValue;
    }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('transactions')
        .update({ [field]: value })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', 'all', accountId] });
      setEditingField(null);
      setEditedValue(null);
      setShowDatePicker(false);
    },
  });

  /**
   * Start editing a field
   */
  const startEdit = useCallback((field: EditingField, currentValue: TransactionValue) => {
    setEditingField(field);
    setEditedValue(currentValue);
  }, []);

  /**
   * Cancel editing and reset state
   */
  const cancelEdit = useCallback(() => {
    setEditingField(null);
    setEditedValue(null);
    setShowDatePicker(false);
  }, []);

  /**
   * Save the edited value
   */
  const saveEdit = useCallback(
    async (transactionId: string, field: string, value: TransactionValue) => {
      if (!transactionId) return;
      await updateMutation.mutateAsync({ id: transactionId, field, value });
    },
    [updateMutation]
  );

  return {
    // State
    editingField,
    editedValue,
    showDatePicker,
    isUpdating: updateMutation.isPending,

    // Setters
    setEditedValue,
    setShowDatePicker,

    // Handlers
    startEdit,
    cancelEdit,
    saveEdit,
  };
}

/**
 * Return type for useTransactionEditor hook
 */
export type UseTransactionEditorReturn = {
  editingField: EditingField;
  editedValue: TransactionValue;
  showDatePicker: boolean;
  isUpdating: boolean;
  setEditedValue: (value: TransactionValue) => void;
  setShowDatePicker: (value: boolean) => void;
  startEdit: (field: EditingField, currentValue: TransactionValue) => void;
  cancelEdit: () => void;
  saveEdit: (transactionId: string, field: string, value: TransactionValue) => Promise<void>;
};
