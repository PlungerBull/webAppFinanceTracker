'use client';

import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { Currency } from '@/types/domain';
import { cn } from '@/lib/utils';
import { CurrencyBalance } from '@/hooks/use-currency-manager';

interface CurrencyManagerProps {
    value: CurrencyBalance[];
    onChange: (value: CurrencyBalance[]) => void;
    availableCurrencies: Currency[];
    allCurrencies: Currency[]; // Need all currencies to look up symbols/names for selected items
    disabled?: boolean;
    renderItemFooter?: (item: CurrencyBalance, index: number) => React.ReactNode;
}

export function CurrencyManager({
    value,
    onChange,
    availableCurrencies,
    allCurrencies,
    disabled = false,
    renderItemFooter,
}: CurrencyManagerProps) {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Click-outside detection for dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                isDropdownOpen
            ) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isDropdownOpen]);

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

    const handleUpdateBalance = (code: string, balance: string) => {
        const numericBalance = parseFloat(balance) || 0;
        const newValue = value.map((c) =>
            c.currency_code === code ? { ...c, starting_balance: numericBalance } : c
        );
        onChange(newValue);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">
                    Currencies & Balances
                </span>

                {/* Add Currency Dropdown */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        type="button"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        disabled={disabled}
                        className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                    >
                        <Plus className="w-3 h-3" />
                        Add Currency
                    </button>

                    {/* Currency Dropdown */}
                    {isDropdownOpen && (
                        <div className="absolute bottom-full right-0 mb-2 bg-white rounded-xl shadow-xl border border-gray-100 z-[60] overflow-hidden max-h-48 overflow-y-auto min-w-[280px]">
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
                    )}
                </div>
            </div>

            {/* Selected Currencies List */}
            {value.length > 0 ? (
                <div className="space-y-2">
                    {value.map((currency, index) => {
                        const currencyData = allCurrencies.find(c => c.code === currency.currency_code);
                        const currencySymbol = currencyData?.symbol || currency.currency_code;

                        return (
                            <div key={currency.currency_code} className="space-y-2">
                                <div
                                    className="flex items-center gap-3 animate-in slide-in-from-left-2 fade-in"
                                >
                                    {/* Currency Badge */}
                                    <div className="w-20 text-xs font-bold text-gray-700 bg-gray-100 rounded-lg py-2 text-center">
                                        {currency.currency_code}
                                    </div>

                                    {/* Amount Input with Currency Symbol */}
                                    <div className="relative flex-1">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                                            {currencySymbol}
                                        </span>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={currency.starting_balance}
                                            onChange={(e) =>
                                                handleUpdateBalance(currency.currency_code, e.target.value)
                                            }
                                            disabled={disabled}
                                            className="font-mono text-sm text-right bg-gray-50 border-transparent hover:bg-white hover:border-gray-200 focus:bg-white focus:border-blue-200 rounded-xl pl-8 pr-4 py-2 transition-all"
                                        />
                                    </div>

                                    {/* Delete Button */}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveCurrency(currency.currency_code)}
                                        disabled={disabled}
                                        className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors hidden sm:block"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveCurrency(currency.currency_code)}
                                        disabled={disabled}
                                        className="sm:hidden p-2 rounded-lg text-red-500"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                                {renderItemFooter && renderItemFooter(currency, index)}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center text-sm text-gray-500 p-4 bg-gray-50/30 border border-gray-100 rounded-xl">
                    No currencies added yet
                </div>
            )}
        </div>
    );
}
