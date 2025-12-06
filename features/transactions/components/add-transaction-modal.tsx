'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useAddTransaction } from '../hooks/use-transactions';
import { useCreateTransfer } from '../hooks/use-transfers';
import { useCategories } from '@/features/categories/hooks/use-categories';
import { useGroupedAccounts } from '@/hooks/use-grouped-accounts';
import { useDirectionToggle } from '../hooks/use-direction-toggle';
import { useTransferCalculation } from '../hooks/use-transfer-calculation';
import { TransactionTypeTabs } from './transaction-type-tabs';
import { SmartSelector } from './smart-selector';
import { CategorySelector } from './category-selector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CreditCard, Tag, Calendar as CalendarIcon, Loader2, AlignLeft, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface AddTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddTransactionModal({ open, onOpenChange }: AddTransactionModalProps) {
  // Mode state
  const [mode, setMode] = useState<'transaction' | 'transfer'>('transaction');

  // Transaction state
  const [amount, setAmount] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [fromAccountId, setFromAccountId] = useState<string | null>(null);
  const [fromCurrency, setFromCurrency] = useState<string | null>(null);
  const [exchangeRateInput, setExchangeRateInput] = useState<string>('');
  const [date, setDate] = useState<Date>(new Date());
  const [payee, setPayee] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Transfer-specific state
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [toCurrency, setToCurrency] = useState<string | null>(null);
  const [receivedAmount, setReceivedAmount] = useState<string>('');

  // Hooks
  const { data: categories = [] } = useCategories();
  const { groupedAccounts } = useGroupedAccounts();
  const { signState, toggleDirection } = useDirectionToggle(categoryId);
  const { exchangeRate, isMultiCurrency, displayRate } = useTransferCalculation(
    amount,
    receivedAmount,
    fromCurrency,
    toCurrency
  );

  // Mutations
  const addTransactionMutation = useAddTransaction();
  const createTransferMutation = useCreateTransfer();

  // Get selected account and available currencies
  const selectedFromAccount = groupedAccounts.find((a) => a.account_id === fromAccountId);
  const selectedToAccount = groupedAccounts.find((a) => a.account_id === toAccountId);
  const selectedCategory = categories.find((c) => c.id === categoryId);

  // Check if account is multi-currency
  const fromAccountCurrencies = selectedFromAccount?.balances.map((b) => b.currency || 'USD') || [];
  const toAccountCurrencies = selectedToAccount?.balances.map((b) => b.currency || 'USD') || [];
  const isFromAccountMultiCurrency = fromAccountCurrencies.length > 1;
  const isToAccountMultiCurrency = toAccountCurrencies.length > 1;

  // Auto-select currency if only one available
  useMemo(() => {
    if (fromAccountId && fromAccountCurrencies.length === 1 && !fromCurrency) {
      setFromCurrency(fromAccountCurrencies[0]);
    }
  }, [fromAccountId, fromAccountCurrencies, fromCurrency]);

  useMemo(() => {
    if (toAccountId && toAccountCurrencies.length === 1 && !toCurrency) {
      setToCurrency(toAccountCurrencies[0]);
    }
  }, [toAccountId, toAccountCurrencies, toCurrency]);

  // Validation
  const isValid = useMemo(() => {
    const hasAmount = parseFloat(amount) > 0;
    const hasFromAccount = fromAccountId && fromCurrency;

    if (mode === 'transaction') {
      return hasAmount && hasFromAccount && categoryId;
    } else {
      const hasToAccount = toAccountId && toCurrency;
      const notSameAccount = !(fromAccountId === toAccountId && fromCurrency === toCurrency);
      const hasReceivedAmount = isMultiCurrency ? parseFloat(receivedAmount) > 0 : true;
      return hasAmount && hasFromAccount && hasToAccount && notSameAccount && hasReceivedAmount;
    }
  }, [mode, amount, fromAccountId, fromCurrency, categoryId, toAccountId, toCurrency, receivedAmount, isMultiCurrency]);

  const isSubmitting = addTransactionMutation.isPending || createTransferMutation.isPending;

  // Handlers
  const handleClose = () => {
    setMode('transaction');
    setAmount('');
    setCategoryId(null);
    setFromAccountId(null);
    setFromCurrency(null);
    setToAccountId(null);
    setToCurrency(null);
    setReceivedAmount('');
    setExchangeRateInput('');
    setDate(new Date());
    setPayee('');
    setNotes('');
    onOpenChange(false);
  };

  const handleFromAccountChange = (accountId: string) => {
    setFromAccountId(accountId);
    setFromCurrency(null); // Reset currency when account changes
  };

  const handleToAccountChange = (accountId: string) => {
    setToAccountId(accountId);
    setToCurrency(null); // Reset currency when account changes
  };

  const handleSubmit = async () => {
    if (!isValid || isSubmitting) return;

    try {
      if (mode === 'transaction') {
        // Transaction mode
        if (!categoryId || !fromAccountId || !fromCurrency) return;

        const finalAmount = signState * parseFloat(amount);
        const rate = exchangeRateInput ? parseFloat(exchangeRateInput) : 1;

        await addTransactionMutation.mutateAsync({
          description: payee || 'Transaction',
          amount_original: finalAmount,
          currency_original: fromCurrency,
          account_id: fromAccountId,
          category_id: categoryId,
          date: format(date, 'yyyy-MM-dd'),
          notes: notes || undefined,
          exchange_rate: rate,
        });
      } else {
        // Transfer mode
        if (!fromAccountId || !fromCurrency || !toAccountId || !toCurrency) return;

        const sent = parseFloat(amount);
        const received = isMultiCurrency ? parseFloat(receivedAmount) : sent;

        // Get current user
        const { data: { user } } = await (await import('@/lib/supabase/client')).createClient().auth.getUser();
        if (!user) throw new Error('User not authenticated');

        await createTransferMutation.mutateAsync({
          userId: user.id,
          fromAccountId,
          toAccountId,
          fromCurrency,
          toCurrency,
          sentAmount: sent,
          receivedAmount: received,
          date: format(date, 'yyyy-MM-dd'),
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
          </VisuallyHidden>
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

            {/* ZONE 1: Header - Mode Switcher */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <TransactionTypeTabs value={mode} onChange={setMode} disabled={isSubmitting} />
              <button
                onClick={handleClose}
                className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ZONE 2: Hero Section - Amount */}
            <div className="relative py-6 px-6 shrink-0">
              {/* Amount Input with Sign Toggle */}
              <div className="flex items-center justify-center gap-3">
                {/* Sign Toggle Button - Transaction Mode Only */}
                {mode === 'transaction' && (
                  <button
                    type="button"
                    onClick={() => toggleDirection(signState === -1 ? 1 : -1)}
                    className="text-2xl font-light text-gray-400 hover:text-gray-600 transition-colors w-6 h-6 flex items-center justify-center"
                  >
                    {signState === -1 ? '−' : '+'}
                  </button>
                )}

                {/* Transfer Arrow - Transfer Mode Only */}
                {mode === 'transfer' && (
                  <div className="text-2xl font-light text-blue-400 w-6 h-6 flex items-center justify-center">
                    →
                  </div>
                )}

                {/* Amount Display and Input */}
                <div className="relative">
                  <span className="text-5xl font-bold text-gray-800 tabular-nums">
                    {amount || '0.00'}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-text"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Currency Display */}
              {fromCurrency && (
                <div className="text-center mt-1">
                  <span className="text-xs font-medium text-gray-400 uppercase">
                    {fromCurrency}
                  </span>
                </div>
              )}
            </div>

            {/* ZONE 3: Form Body */}
            <div className="px-6 py-6 space-y-5 flex-1">

              {/* Transaction Mode Fields */}
              {mode === 'transaction' && (
                <>
                  {/* Payee */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Payee
                    </Label>
                    <Input
                      placeholder="e.g. Starbucks, Uber, Rent"
                      value={payee}
                      onChange={(e) => setPayee(e.target.value)}
                      className="text-base bg-gray-50 border-transparent focus:bg-white focus:border-gray-200 rounded-xl px-4 py-3"
                    />
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Notes (Optional)
                    </Label>
                    <Input
                      placeholder="Add notes..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="text-base bg-gray-50 border-transparent focus:bg-white focus:border-gray-200 rounded-xl px-4 py-3"
                    />
                  </div>
                </>
              )}

              {/* Transfer Mode Fields */}
              {mode === 'transfer' && (
                <>
                  {/* To Account Selector */}
                  <div className="p-4 border-2 border-blue-200 bg-blue-50/50 rounded-xl space-y-3">
                    <Label className="text-xs font-semibold text-blue-600 uppercase">
                      To Account
                    </Label>
                    <Select value={toAccountId || ''} onValueChange={handleToAccountChange}>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {groupedAccounts
                          .filter((account) => account.is_visible && account.account_id !== fromAccountId)
                          .map((account) => (
                            <SelectItem key={account.account_id} value={account.account_id}>
                              {account.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>

                    {/* To Currency Selector - Only if multi-currency */}
                    {toAccountId && isToAccountMultiCurrency && (
                      <Select value={toCurrency || ''} onValueChange={setToCurrency}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {toAccountCurrencies.map((currency) => (
                            <SelectItem key={currency} value={currency}>
                              {currency}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Multi-Currency Conversion - Implied Rate */}
                  {isMultiCurrency && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
                      <Label className="text-xs font-semibold text-blue-700 uppercase">
                        Amount Received in {toCurrency}
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-blue-600">
                          {toCurrency}
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Amount received"
                          value={receivedAmount}
                          onChange={(e) => setReceivedAmount(e.target.value)}
                          className="pl-12 pr-4 py-3 text-right font-mono text-lg bg-white border-blue-300 focus:border-blue-400 rounded-xl"
                        />
                      </div>
                      {/* Display implied exchange rate */}
                      {displayRate && (
                        <div className="text-xs text-blue-600 text-center">
                          Implied Rate: {displayRate}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ZONE 4: Footer - Control Center */}
            <div className="bg-white border-t border-gray-100 p-4 rounded-b-3xl shrink-0">
              <div className="flex items-center justify-between gap-3 mb-3">
                {/* Left Side: Chips */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Account (From) - Always visible */}
                  <SmartSelector
                    icon={CreditCard}
                    label="Account"
                    value={selectedFromAccount?.name}
                    placeholder="Account"
                    required
                    error={!fromAccountId}
                  >
                    <div className="w-72 max-h-96 overflow-y-auto p-2">
                      {groupedAccounts
                        .filter((account) => account.is_visible)
                        .map((account) => (
                          <button
                            key={account.account_id}
                            type="button"
                            onClick={() => handleFromAccountChange(account.account_id)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                              fromAccountId === account.account_id
                                ? "bg-gray-100 text-gray-900 font-medium"
                                : "text-gray-700 hover:bg-gray-50"
                            )}
                          >
                            <CreditCard
                              className="w-4 h-4 flex-shrink-0"
                              style={{ color: account.color }}
                            />
                            <span className="flex-1 text-left">{account.name}</span>
                          </button>
                        ))}
                    </div>
                  </SmartSelector>

                  {/* Currency Selector - Only if multi-currency account */}
                  {fromAccountId && isFromAccountMultiCurrency && (
                    <Select value={fromCurrency || ''} onValueChange={setFromCurrency}>
                      <SelectTrigger className="w-24 h-10 rounded-xl border-gray-300">
                        <SelectValue placeholder="Currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {fromAccountCurrencies.map((currency) => (
                          <SelectItem key={currency} value={currency}>
                            {currency}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {/* Category - Transaction Mode Only */}
                  {mode === 'transaction' && (
                    <SmartSelector
                      icon={Tag}
                      label="Category"
                      value={selectedCategory?.name || undefined}
                      placeholder="Category"
                      required
                      error={!categoryId}
                    >
                      <CategorySelector
                        value={categoryId || undefined}
                        onChange={setCategoryId}
                      />
                    </SmartSelector>
                  )}

                  {/* Date */}
                  <SmartSelector
                    icon={CalendarIcon}
                    label="Date"
                    value={format(date, 'MMM d')}
                  >
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(d) => d && setDate(d)}
                      initialFocus
                    />
                  </SmartSelector>
                </div>
              </div>

              {/* Exchange Rate Input - Only if different currency from home */}
              {mode === 'transaction' && fromCurrency && fromCurrency !== 'PEN' && (
                <div className="mb-3">
                  <Input
                    type="number"
                    step="0.0001"
                    placeholder={`Exchange rate (${fromCurrency} to PEN)`}
                    value={exchangeRateInput}
                    onChange={(e) => setExchangeRateInput(e.target.value)}
                    className="text-sm bg-gray-50 border-gray-200 rounded-lg px-3 py-2"
                  />
                </div>
              )}

              {/* Submit Button */}
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
                    {mode === 'transfer' ? 'Transferring...' : 'Adding...'}
                  </>
                ) : (
                  mode === 'transfer' ? 'Transfer Funds' : 'Add Transaction'
                )}
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
