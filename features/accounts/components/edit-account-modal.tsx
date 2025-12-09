'use client';

import { useState, useEffect, useRef } from 'react';
import { useFormModal } from '@/hooks/shared/use-form-modal';
import { useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { accountsApi } from '../api/accounts';
// TODO: Rewrite for container pattern - see CONTAINER_ACCOUNT_MIGRATION_SUMMARY.md
// import { accountCurrenciesApi } from '../api/account-currencies';
import { updateAccountSchema, type UpdateAccountFormData } from '../schemas/account.schema';
import { useCurrencies } from '@/features/currencies/hooks/use-currencies';
import type { Database } from '@/types/database.types';
import { DashboardModal } from '@/components/shared/dashboard-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Pencil, Trash2, Loader2, Check, ChevronDown } from 'lucide-react';
import { ACCOUNT, QUERY_KEYS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Account as DomainAccount } from '@/types/domain';

import { CurrencyManager } from './currency-manager';
import type { CurrencyBalance } from '@/hooks/use-currency-manager';

type BankAccount = Database['public']['Tables']['bank_accounts']['Row'];
// type AccountCurrency = Database['public']['Tables']['account_currencies']['Row']; // OLD SCHEMA

// Stub type for backward compatibility - TODO: Remove when edit modal is rewritten
interface AccountCurrency {
  id: string;
  account_id: string;
  currency_code: string;
  created_at: string;
  updated_at: string;
}

interface EditAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: DomainAccount | null;
  onDelete?: (accountId: string) => void;
}

interface CurrencyReplacement {
  oldCurrency: AccountCurrency;
  newCurrencyCode: string;
  newStartingBalance: number;
  originalStartingBalance: number;
}

export function EditAccountModal({ open, onOpenChange, account, onDelete }: EditAccountModalProps) {
  const queryClient = useQueryClient();

  const [currencyReplacements, setCurrencyReplacements] = useState<CurrencyReplacement[]>([]);
  const [isColorPopoverOpen, setIsColorPopoverOpen] = useState(false);

  const { data: allCurrencies = [] } = useCurrencies();

  // TODO: Rewrite for container pattern - fetch grouped accounts by group_id
  // Fetch account currencies when modal opens
  const { data: accountCurrencies = [], isLoading: loadingCurrencies } = useQuery({
    queryKey: ['edit-account-stub', account?.id],
    queryFn: () => Promise.resolve([]), // Stub - returns empty array
    enabled: false, // Disabled until rewrite
  });

  const onSubmit = async (data: UpdateAccountFormData) => {
    if (!account) return;

    // Step 1: Update account name and color
    await accountsApi.update(account.id, data);

    // TODO: Rewrite currency replacement for container pattern
    // Step 2: Process currency replacements (DISABLED - needs container pattern rewrite)
    // for (const replacement of currencyReplacements) {
    //   const oldCode = replacement.oldCurrency.currency_code;
    //   const newCode = replacement.newCurrencyCode.toUpperCase();
    //   const isNewCurrency = replacement.oldCurrency.id.startsWith('new-');
    //   ... (API calls commented out)
    // }

    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
    // queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNT_CURRENCIES() }); // OLD SCHEMA
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRANSACTIONS.ALL });

    setCurrencyReplacements([]);
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
    setCurrencyReplacements([]);
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

  // Initialize form and currency replacements
  useEffect(() => {
    if (account) {
      reset({
        name: account.name,
        color: account.color || ACCOUNT.DEFAULT_COLOR,
      });

      // TODO: Rewrite for container pattern - fetch grouped accounts and initialize currency replacements
      // setCurrencyReplacements(
      //   accountCurrencies.map((ac) => ({
      //     oldCurrency: ac,
      //     newCurrencyCode: ac.currency_code,
      //     newStartingBalance: 0,
      //     originalStartingBalance: 0,
      //   }))
      // );
    }
  }, [account, reset]);

  // Transform replacements to CurrencyBalance[] for the CurrencyManager
  const currencyBalances: CurrencyBalance[] = currencyReplacements.map(r => ({
    currency_code: r.newCurrencyCode,
    starting_balance: r.newStartingBalance
  }));

  // Handle changes from CurrencyManager
  const handleCurrenciesChange = (newBalances: CurrencyBalance[]) => {
    // 1. Identify removed items
    const newCodes = new Set(newBalances.map(b => b.currency_code));
    const keptReplacements = currencyReplacements.filter(r => newCodes.has(r.newCurrencyCode));

    // 2. Identify added items
    const existingCodes = new Set(currencyReplacements.map(r => r.newCurrencyCode));
    const addedBalances = newBalances.filter(b => !existingCodes.has(b.currency_code));

    // 3. Update balances for kept items
    const updatedReplacements = keptReplacements.map(r => {
      const newBalance = newBalances.find(b => b.currency_code === r.newCurrencyCode);
      return newBalance ? { ...r, newStartingBalance: newBalance.starting_balance } : r;
    });

    // 4. Create new replacements for added items
    const newReplacements = addedBalances.map(b => ({
      oldCurrency: {
        id: `new-${Date.now()}-${Math.random()}`,
        account_id: account?.id || '',
        currency_code: b.currency_code,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as AccountCurrency,
      newCurrencyCode: b.currency_code,
      newStartingBalance: b.starting_balance,
      originalStartingBalance: 0,
    }));

    setCurrencyReplacements([...updatedReplacements, ...newReplacements]);
  };

  const availableCurrencies = allCurrencies.filter(
    (currency) => !currencyReplacements.some((cr) => cr.newCurrencyCode === currency.code)
  );

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
      description="Edit account name, color, and manage currencies"
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

          {/* Currencies & Balances */}
          {loadingCurrencies ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <CurrencyManager
              value={currencyBalances}
              onChange={handleCurrenciesChange}
              availableCurrencies={availableCurrencies}
              allCurrencies={allCurrencies}
              disabled={isSubmitting}
              renderItemFooter={(item) => {
                // Find the replacement corresponding to this item
                const replacement = currencyReplacements.find(r => r.newCurrencyCode === item.currency_code);
                if (!replacement) return null;

                if (replacement.oldCurrency.currency_code !== replacement.newCurrencyCode &&
                  !replacement.oldCurrency.id.startsWith('new-')) {
                  return (
                    <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg ml-[76px]">
                      ⚠️ Changing from {replacement.oldCurrency.currency_code} to {replacement.newCurrencyCode} will update all transactions
                    </div>
                  );
                }
                return null;
              }}
            />
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
