'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useAddTransaction } from '../hooks/use-transactions';
import { useCreateTransfer } from '../hooks/use-transfers';
import { useCategories } from '@/features/categories/hooks/use-categories';
import { useGroupedAccounts } from '@/hooks/use-grouped-accounts';
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
import { CreditCard, Tag, Calendar as CalendarIcon, Loader2, AlignLeft, X, ArrowDown } from 'lucide-react';
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
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Transfer-specific state
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [toCurrency, setToCurrency] = useState<string | null>(null);
  const [receivedAmount, setReceivedAmount] = useState<string>('');

  // Hooks
  const { data: categories = [] } = useCategories();
  const { groupedAccounts } = useGroupedAccounts();
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

  // Check if transfer currencies are the same
  const isSameCurrencyTransfer = mode === 'transfer' && fromCurrency === toCurrency;

  // Check if it's a loop transfer (same account + same currency)
  const isLoopTransfer = fromAccountId === toAccountId && fromCurrency === toCurrency;

  // Validation
  const isValid = useMemo(() => {
    const hasAmount = parseFloat(amount) > 0;
    const hasFromAccount = fromAccountId && fromCurrency;

    if (mode === 'transaction') {
      return hasAmount && hasFromAccount && categoryId;
    } else {
      const hasToAccount = toAccountId && toCurrency;
      const notLoop = !isLoopTransfer;
      const hasReceivedAmount = !isSameCurrencyTransfer ? parseFloat(receivedAmount) > 0 : true;
      return hasAmount && hasFromAccount && hasToAccount && notLoop && hasReceivedAmount;
    }
  }, [mode, amount, fromAccountId, fromCurrency, categoryId, toAccountId, toCurrency, receivedAmount, isSameCurrencyTransfer, isLoopTransfer]);

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
    setHasSubmitted(false);
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
    setHasSubmitted(true);
    if (!isValid || isSubmitting) return;

    try {
      if (mode === 'transaction') {
        // Transaction mode
        if (!categoryId || !fromAccountId || !fromCurrency) return;

        const finalAmount = parseFloat(amount);
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
        // If same currency, received = sent. Otherwise use the received amount input
        const received = isSameCurrencyTransfer ? sent : parseFloat(receivedAmount);

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
            <div className="relative pt-6 pb-2 flex items-center justify-center shrink-0">
              <TransactionTypeTabs value={mode} onChange={setMode} disabled={isSubmitting} />
              <button
                onClick={handleClose}
                className="absolute top-6 right-6 p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ZONE 2: Hero Section - Amount (TRANSACTION MODE ONLY) */}
            {mode === 'transaction' && (
              <div className="relative py-6 px-6 shrink-0">
                {/* Amount Input */}
                <div className="flex items-center justify-center gap-3">
                  <div className="relative flex justify-center">
                    <span
                      className={cn(
                        "text-5xl tabular-nums transition-colors text-center",
                        amount ? "font-bold text-black" : "font-medium text-gray-300"
                      )}
                    >
                      {amount || '0.00'}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (/^[+-]?\d*\.?\d*$/.test(value)) {
                          setAmount(value);
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-text text-center"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Currency Display - Only for multi-currency accounts in Transaction mode */}
                {fromCurrency && isFromAccountMultiCurrency && (
                  <div className="text-center mt-1">
                    <span className="text-xs font-medium text-gray-400 uppercase">
                      {fromCurrency}
                    </span>
                  </div>
                )}
              </div>
            )}

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

              {/* Transfer Mode - Vertical Flow */}
              {mode === 'transfer' && (
                <div className="space-y-0 relative">

                  {/* SOURCE CARD (Top) */}
                  <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5 relative z-20">
                    <div className="flex items-start justify-between mb-4">
                      {/* Account Selector */}
                      <Select value={fromAccountId || ''} onValueChange={handleFromAccountChange}>
                        <SelectTrigger className="border-0 bg-transparent p-0 h-auto hover:bg-transparent shadow-none w-auto gap-2">
                          <SelectValue placeholder="Select source account">
                            <span className={cn("text-lg font-semibold", !fromAccountId && "text-gray-400 font-normal")}>
                              {selectedFromAccount?.name || 'Select source account'}
                            </span>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="max-h-80">
                          {groupedAccounts
                            .filter((account) => account.is_visible)
                            .map((account) => (
                              <SelectItem key={account.account_id} value={account.account_id}>
                                {account.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>

                      {/* Currency Toggle (Pills) */}
                      {isFromAccountMultiCurrency ? (
                        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
                          {fromAccountCurrencies.map((currency) => (
                            <button
                              key={currency}
                              type="button"
                              onClick={() => setFromCurrency(currency)}
                              className={cn(
                                "px-2 py-0.5 rounded-md text-xs font-bold transition-all",
                                fromCurrency === currency
                                  ? "bg-white text-gray-900 shadow-sm"
                                  : "text-gray-500 hover:text-gray-700"
                              )}
                            >
                              {currency}
                            </button>
                          ))}
                        </div>
                      ) : (
                        fromCurrency && (
                          <div className="bg-gray-100 px-2 py-1 rounded-md text-xs font-bold text-gray-500">
                            {fromCurrency}
                          </div>
                        )
                      )}
                    </div>

                    {/* Amount Input */}
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-light text-gray-300">$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (/^[+-]?\d*\.?\d*$/.test(value)) {
                            setAmount(value);
                          }
                        }}
                        placeholder="0.00"
                        className={cn(
                          "text-4xl font-bold bg-transparent border-0 outline-none p-0 w-full tabular-nums placeholder:text-gray-200",
                          amount ? "text-gray-900" : "text-gray-300"
                        )}
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* CONNECTOR ARROW */}
                  <div className="absolute left-1/2 -ml-4 top-[135px] z-30">
                    <div className="bg-white p-1 rounded-full shadow-sm border border-gray-100">
                      <div className="bg-gray-50 p-1.5 rounded-full">
                        <ArrowDown className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  </div>

                  {/* DESTINATION CARD (Bottom) */}
                  <div className={cn(
                    "rounded-2xl p-5 mt-[-10px] pt-8 relative z-10 transition-colors duration-300",
                    !isSameCurrencyTransfer && toCurrency
                      ? "bg-blue-50/50 border border-blue-100" // Unlocked State
                      : "bg-gray-50 border border-gray-100"   // Locked/Mirror State
                  )}>
                    <div className="flex items-start justify-between mb-4">
                      {/* Account Selector */}
                      <Select value={toAccountId || ''} onValueChange={handleToAccountChange}>
                        <SelectTrigger className="border-0 bg-transparent p-0 h-auto hover:bg-transparent shadow-none w-auto gap-2">
                          <SelectValue placeholder="Select destination account">
                            <span className={cn("text-lg font-semibold", !toAccountId && "text-gray-400 font-normal")}>
                              {selectedToAccount?.name || 'Select destination account'}
                            </span>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="max-h-80">
                          {groupedAccounts
                            .filter((account) => account.is_visible && account.account_id !== fromAccountId) // Smart Filter: Hide Source
                            .map((account) => (
                              <SelectItem key={account.account_id} value={account.account_id}>
                                {account.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>

                      {/* Currency Toggle (Pills) */}
                      {isToAccountMultiCurrency ? (
                        <div className="flex bg-white/50 border border-black/5 rounded-lg p-1 gap-1">
                          {toAccountCurrencies.map((currency) => (
                            <button
                              key={currency}
                              type="button"
                              onClick={() => setToCurrency(currency)}
                              className={cn(
                                "px-2 py-0.5 rounded-md text-xs font-bold transition-all",
                                toCurrency === currency
                                  ? "bg-gray-900 text-white shadow-sm"
                                  : "text-gray-500 hover:text-gray-700"
                              )}
                            >
                              {currency}
                            </button>
                          ))}
                        </div>
                      ) : (
                        toCurrency && (
                          <div className="bg-white/50 border border-black/5 px-2 py-1 rounded-md text-xs font-bold text-gray-500">
                            {toCurrency}
                          </div>
                        )
                      )}
                    </div>

                    {/* Amount Logic */}
                    <div className="flex items-baseline gap-1">
                      <span className={cn(
                        "text-2xl font-light transition-colors",
                        !isSameCurrencyTransfer && toCurrency ? "text-blue-300" : "text-gray-300"
                      )}>$</span>

                      {isSameCurrencyTransfer ? (
                        // MIRROR MODE: Read Only
                        <span className={cn(
                          "text-4xl font-bold tabular-nums",
                          amount ? "text-gray-400" : "text-gray-300"
                        )}>
                          {amount || '0.00'}
                        </span>
                      ) : (
                        // UNLOCK MODE: Editable
                        <div className="relative w-full">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={receivedAmount}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (/^\d*\.?\d*$/.test(value)) {
                                setReceivedAmount(value);
                                // If exchange rate implied, we might show it somewhere, but UI doesn't explicitly ask for rate display anymore, just input.
                              }
                            }}
                            placeholder="0.00"
                            className={cn(
                              "text-4xl font-bold bg-transparent border-0 outline-none p-0 w-full tabular-nums placeholder:text-blue-200/50",
                              receivedAmount ? "text-blue-600" : "text-blue-300"
                            )}
                          />
                          {!receivedAmount && toCurrency && (
                            <div className="absolute top-full left-0 mt-1 text-xs text-blue-500 font-medium animate-pulse">
                              Unlocked: Enter exchanged amount
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Loop Warning */}
                  {isLoopTransfer && (
                    <div className="text-xs text-red-500 bg-red-50 p-2 rounded-lg text-center font-medium">
                      Cannot transfer to the same account with the same currency
                    </div>
                  )}

                  {/* Footer: Date & Notes */}
                  <div className="mt-4 flex items-center gap-3">
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

                    <div className="flex-1">
                      <Input
                        placeholder="Add a note (optional)"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="h-11 text-sm bg-gray-50 border-gray-200 focus:bg-white focus:border-gray-300 rounded-xl"
                      />
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* ZONE 4: Footer - Control Center */}
            <div className="bg-white border-t border-gray-100 p-4 rounded-b-3xl shrink-0">
              {mode === 'transaction' && (
                <div className="flex items-center justify-center gap-3 mb-3">
                  {/* Centered Chips */}
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    {/* Account (From) */}
                    <SmartSelector
                      icon={CreditCard}
                      label="Account"
                      value={selectedFromAccount?.name}
                      placeholder="Account"
                      required
                      error={hasSubmitted && !fromAccountId}
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

                    {/* Category */}
                    <SmartSelector
                      icon={Tag}
                      label="Category"
                      value={selectedCategory?.name || undefined}
                      placeholder="Category"
                      required
                      error={hasSubmitted && !categoryId}
                    >
                      <CategorySelector
                        value={categoryId || undefined}
                        onChange={setCategoryId}
                      />
                    </SmartSelector>

                    {/* Date - Transaction Mode Only */}
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
              )}

              {/* Exchange Rate Input - Only if different currency from home (Transaction Mode) */}
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
