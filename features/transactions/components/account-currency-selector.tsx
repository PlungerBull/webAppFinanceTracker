'use client';

import { useGroupedAccounts } from '@/lib/hooks/use-grouped-accounts';
import { cn } from '@/lib/utils';
import { Check, CreditCard } from 'lucide-react';

interface AccountCurrencySelectorProps {
  value: string | null; // account_id
  currencyValue: string | null; // currency code
  onChange: (accountId: string, currency: string) => void;
  excludeAccountCurrency?: { accountId: string; currency: string }; // For transfer mode
  disabled?: boolean;
}

export function AccountCurrencySelector({
  value,
  currencyValue,
  onChange,
  excludeAccountCurrency,
  disabled = false,
}: AccountCurrencySelectorProps) {
  const { groupedAccounts, isLoading } = useGroupedAccounts();

  // Flatten accounts into account-currency combinations
  const accountCurrencyOptions = groupedAccounts
    // .filter((account) => account.isVisible) // isVisible not available in GroupedAccount
    .flatMap((account) =>
      account.balances.map((balance) => ({
        accountId: balance.accountId, // Use the specific currency account ID from balance
        accountName: account.name,
        accountColor: account.color,
        currency: balance.currency || 'USD',
        // Create unique key for selection
        key: `${balance.accountId}-${balance.currency}`,
      }))
    )
    .filter((option) => {
      // Exclude specific account-currency combination if provided
      if (excludeAccountCurrency) {
        return !(
          option.accountId === excludeAccountCurrency.accountId &&
          option.currency === excludeAccountCurrency.currency
        );
      }
      return true;
    });

  const selectedKey = value && currencyValue ? `${value}-${currencyValue}` : null;

  if (isLoading) {
    return (
      <div className="w-72 p-4 text-center text-sm text-gray-400">
        Loading accounts...
      </div>
    );
  }

  return (
    <div className="w-72 max-h-96 overflow-y-auto p-2">
      {accountCurrencyOptions.length === 0 ? (
        <div className="px-3 py-8 text-center text-sm text-gray-400">
          No accounts available
        </div>
      ) : (
        <div className="space-y-1">
          {accountCurrencyOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => !disabled && onChange(option.accountId, option.currency)}
              disabled={disabled}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                selectedKey === option.key
                  ? "bg-gray-100 text-gray-900 font-medium"
                  : "text-gray-700 hover:bg-gray-50",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <CreditCard
                className="w-4 h-4 flex-shrink-0"
                style={{ color: option.accountColor }}
              />
              <span className="flex-1 text-left">
                {option.accountName} - {option.currency}
              </span>
              {selectedKey === option.key && <Check className="w-4 h-4 text-gray-900" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
