'use client';

import { useState, useEffect } from 'react';
import { useFormModal } from '@/hooks/shared/use-form-modal';
import { useQueryClient } from '@tanstack/react-query';
import { accountsApi } from '../api/accounts';
import { updateAccountSchema, type UpdateAccountFormData } from '../schemas/account.schema';
import { DashboardModal } from '@/components/shared/dashboard-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Trash2, Loader2, Check, ChevronDown } from 'lucide-react';
import { ACCOUNT, QUERY_KEYS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Account as DomainAccount } from '@/types/domain';

interface EditAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: DomainAccount | null;
  onDelete?: (accountId: string) => void;
}

export function EditAccountModal({ open, onOpenChange, account, onDelete }: EditAccountModalProps) {
  const queryClient = useQueryClient();

  const [isColorPopoverOpen, setIsColorPopoverOpen] = useState(false);

  const onSubmit = async (data: UpdateAccountFormData) => {
    if (!account) return;

    // Update account name and color
    await accountsApi.update(account.id, data);

    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRANSACTIONS.ALL });

    onOpenChange(false);
  };

  const {
    form,
    error,
    handleClose: resetForm,
    handleSubmit,
  } = useFormModal(updateAccountSchema, onSubmit);

  const handleClose = () => {
    resetForm();
    setIsColorPopoverOpen(false);
    onOpenChange(false);
  };

  const {
    register,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
  } = form;

  const selectedColor = watch('color');
  const accountName = watch('name');

  // Initialize form
  useEffect(() => {
    if (account) {
      reset({
        name: account.name,
        color: account.color || ACCOUNT.DEFAULT_COLOR,
      });
    }
  }, [account, reset]);

  const handleDelete = async () => {
    if (!account || !onDelete) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${account.name}"? This action cannot be undone.`
    );

    if (confirmed) {
      onDelete(account.id);
      handleClose();
    }
  };

  // Get first letter for icon
  const getInitial = () => {
    return accountName ? accountName.charAt(0).toUpperCase() : 'A';
  };

  return (
    <DashboardModal
      open={open}
      onOpenChange={handleClose}
      title="Edit Account"
      description="Edit account name and color"
      maxWidth="max-w-lg"
    >
      <DashboardModal.Form onSubmit={handleSubmit}>
        {/* HEADER: Icon + Title + Color Picker */}
        <DashboardModal.Header>
          {/* Icon with Color Picker */}
          <Popover open={isColorPopoverOpen} onOpenChange={setIsColorPopoverOpen}>
            <PopoverTrigger asChild>
              <div className="relative">
                <DashboardModal.Icon color={selectedColor || ACCOUNT.DEFAULT_COLOR}>
                  {getInitial()}
                </DashboardModal.Icon>
                <div className="absolute -bottom-1 -right-1 bg-white p-1.5 rounded-full shadow-sm">
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                </div>
              </div>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-3 bg-white rounded-2xl shadow-xl border border-gray-100">
              <div className="grid grid-cols-5 gap-3">
                {ACCOUNT.COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      setValue('color', color, { shouldDirty: true });
                      setIsColorPopoverOpen(false);
                    }}
                    className={cn(
                      'w-8 h-8 rounded-full transition-all flex items-center justify-center',
                      selectedColor === color && 'ring-2 ring-offset-2 ring-gray-900'
                    )}
                    style={{ backgroundColor: color }}
                  >
                    {selectedColor === color && (
                      <Check className="w-4 h-4 text-white drop-shadow-md" strokeWidth={3} />
                    )}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Title Input */}
          <DashboardModal.Title>
            <Input
              {...register('name')}
              className={cn(
                'text-2xl font-bold text-gray-900 border-transparent bg-transparent hover:bg-gray-50 hover:border-gray-200 focus:bg-white focus:border-blue-200 ring-0 focus:ring-0 px-4 py-2 rounded-xl transition-all',
                errors.name && 'border-red-300'
              )}
              placeholder="Account name"
              autoComplete="off"
            />
            {errors.name && <p className="text-xs text-red-500 mt-1 px-4">{errors.name.message}</p>}
          </DashboardModal.Title>
        </DashboardModal.Header>

        <DashboardModal.Divider />

        {/* BODY: Scrollable Content */}
        <DashboardModal.Body>
          <DashboardModal.Error error={error} />

          {/* Account Info Display */}
          {account && (
            <div className="space-y-3">
              <div className="bg-gray-50 p-4 rounded-xl">
                <div className="text-sm text-gray-500 mb-1">Currency</div>
                <div className="text-lg font-semibold text-gray-900">{account.currencyCode}</div>
              </div>
              <div className="text-xs text-gray-500 px-1">
                To change the currency, create a new account with the desired currency.
              </div>
            </div>
          )}

        </DashboardModal.Body>

        {/* FOOTER: Fixed at Bottom */}
        <DashboardModal.Footer>
          {/* Delete Account Button */}
          {onDelete && (
            <Button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting}
              variant="destructive"
              className="bg-red-50 text-red-600 hover:bg-red-100 p-3 rounded-xl transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          )}

          {/* Save Changes Button */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-gray-900 hover:bg-black text-white font-bold text-sm py-3.5 rounded-xl shadow-lg shadow-gray-200 hover:shadow-xl transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DashboardModal.Footer>
      </DashboardModal.Form>
    </DashboardModal>
  );
}
