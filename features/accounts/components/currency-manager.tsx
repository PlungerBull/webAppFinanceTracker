'use client';

import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, X } from 'lucide-react';
import { Currency } from '@/types/domain';
import { CurrencyBalance } from '@/hooks/use-currency-manager';

interface CurrencyManagerProps {
    value: CurrencyBalance[];
    onChange: (value: CurrencyBalance[]) => void;
    availableCurrencies: Currency[];
    allCurrencies: Currency[]; // Need all currencies to look up symbols/names for selected items
    disabled?: boolean;
}

export function CurrencyManager({
    value,
    onChange,
    availableCurrencies,
    allCurrencies,
    disabled = false,
}: CurrencyManagerProps) {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const handleAddCurrency = (code: string) => {
        const newValue = [
            ...value,
            { currency_code: code, starting_balance: 0 },
        ];
        onChange(newValue);
        setIsDropdownOpen(false);
    };

    const handleRemoveCurrency = (code: string) => {
        const newValue = value.filter((c) => c.currency_code !== code);
        onChange(newValue);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">
                    Currencies & Balances
                </span>

                {/* Add Currency Dropdown */}
                <Popover open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            disabled={disabled}
                            className="text-xs font-bold text-blue-600 hover:bg-white hover:border hover:border-blue-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                        >
                            <Plus className="w-3 h-3" />
                            Add Currency
                        </button>
                    </PopoverTrigger>
                    <PopoverContent
                        align="end"
                        side="top"
                        className="w-[280px] p-0 bg-white rounded-xl shadow-xl border border-gray-100"
                    >
                        <div className="max-h-48 overflow-y-auto">
                            {availableCurrencies.length > 0 ? (
                                availableCurrencies.map((currency) => (
                                    <div
                                        key={currency.code}
                                        onClick={() => handleAddCurrency(currency.code)}
                                        className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-center gap-2 transition-colors"
                                    >
                                        {currency.flag && <span>{currency.flag}</span>}
                                        <span className="font-medium text-sm">{currency.code}</span>
                                        <span className="text-xs text-gray-500">- {currency.name}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="px-4 py-3 text-center text-sm text-gray-500">
                                    All currencies added
                                </div>
                            )}
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            {/* Selected Currencies List - Simple badges only, no balances */}
            {value.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                    {value.map((currency) => {
                        const currencyData = allCurrencies.find(c => c.code === currency.currency_code);

                        return (
                            <div
                                key={currency.currency_code}
                                className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium text-gray-700 animate-in slide-in-from-left-2 fade-in"
                            >
                                {currencyData?.flag && <span>{currencyData.flag}</span>}
                                <span>{currency.currency_code}</span>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveCurrency(currency.currency_code)}
                                    disabled={disabled}
                                    className="ml-1 p-0.5 rounded text-gray-400 hover:text-red-500 hover:bg-white hover:border hover:border-red-200 transition-colors"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center text-sm text-gray-500 p-4 bg-white border border-gray-100 rounded-xl">
                    No currencies added yet
                </div>
            )}
        </div>
    );
}
