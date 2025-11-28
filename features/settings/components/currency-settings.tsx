'use client';

import { useCurrencies } from '@/features/currencies/hooks/use-currencies';
import { useUserSettings } from '@/features/settings/hooks/use-user-settings';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface CurrencySettingsProps {
    selectedCurrency: string;
    onCurrencyChange: (value: string) => void;
    disabled?: boolean;
}

export function CurrencySettings({
    selectedCurrency,
    onCurrencyChange,
    disabled = false
}: CurrencySettingsProps) {
    const { data: currencies = [], isLoading: loadingCurrencies } = useCurrencies();
    const { isLoading: loadingSettings } = useUserSettings();

    if (loadingCurrencies || loadingSettings) {
        return (
            <div className="flex justify-center items-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Currency Settings</h3>
                <p className="text-sm text-muted-foreground">
                    Set your main currency for displaying balances and summaries.
                </p>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="main-currency">Main Currency</Label>
                    <Select
                        value={selectedCurrency}
                        onValueChange={onCurrencyChange}
                        disabled={disabled}
                    >
                        <SelectTrigger id="main-currency" className="w-full sm:w-[300px]">
                            <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                            {currencies.map((currency) => (
                                <SelectItem key={currency.code} value={currency.code}>
                                    <div className="flex items-center gap-2">
                                        {currency.flag && <span>{currency.flag}</span>}
                                        <span className="font-medium">{currency.code}</span>
                                        <span className="text-muted-foreground">- {currency.name}</span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    );
}
