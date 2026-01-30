'use client';

import { useState, useEffect } from 'react';
import { useAccountsData } from '@/lib/hooks/use-reference-data';
import { useUpdateAccountVisibility } from '@/features/settings/hooks/use-update-account-visibility';
import { useUserSettings, useUpdateMainCurrency } from '@/features/settings/hooks/use-user-settings';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { DollarSign, Loader2, Save } from 'lucide-react';
import { ACCOUNT_UI } from '@/lib/constants';
import { CurrencySettings } from './currency-settings';

/**
 * Appearance Settings Component
 *
 * Uses useAccountsData from lib/ to avoid feature-to-feature coupling.
 */
export function AppearanceSettings() {
    const { accounts, isLoading } = useAccountsData();
    const { mutate: updateVisibility, isPending: isSavingVisibility } = useUpdateAccountVisibility();
    const { data: userSettings } = useUserSettings();
    const { mutate: updateMainCurrency, isPending: isSavingCurrency } = useUpdateMainCurrency();

    // Local state for pending changes
    const [pendingVisibility, setPendingVisibility] = useState<Record<string, boolean>>({});
    const [selectedCurrency, setSelectedCurrency] = useState<string>('');
    const [hasChanges, setHasChanges] = useState(false);

    // Initialize local state from fetched data
    useEffect(() => {
        if (accounts.length > 0) {
            const initialVisibility: Record<string, boolean> = {};
            accounts.forEach(acc => {
                if (acc.id) {
                    initialVisibility[acc.id] = acc.isVisible ?? true;
                }
            });
            setPendingVisibility(initialVisibility);
        }
    }, [accounts]);

    // Initialize currency from user settings
    useEffect(() => {
        if (userSettings?.mainCurrency) {
            setSelectedCurrency(userSettings.mainCurrency);
        }
    }, [userSettings]);

    // Check for changes whenever state updates
    useEffect(() => {
        let changed = false;

        // Check account visibility changes
        for (const acc of accounts) {
            if (acc.id && pendingVisibility[acc.id] !== (acc.isVisible ?? true)) {
                changed = true;
                break;
            }
        }

        // Check currency changes
        if (selectedCurrency && selectedCurrency !== userSettings?.mainCurrency) {
            changed = true;
        }

        setHasChanges(changed);
    }, [pendingVisibility, selectedCurrency, userSettings, accounts]);

    const handleToggle = (accountId: string) => {
        setPendingVisibility((prev) => ({
            ...prev,
            [accountId]: !prev[accountId]
        }));
    };

    const handleCurrencyChange = (value: string) => {
        setSelectedCurrency(value);
    };

    const handleSave = async () => {
        const promises: Promise<any>[] = [];

        // Save account visibility changes
        const visibilityUpdates = Object.entries(pendingVisibility)
            .filter(([accountId, isVisible]) => {
                const account = accounts.find(acc => acc.id === accountId);
                const currentValue = account?.isVisible ?? true;
                return isVisible !== currentValue;
            })
            .map(([accountId, isVisible]) => ({ accountId, isVisible }));

        if (visibilityUpdates.length > 0) {
            promises.push(
                new Promise((resolve, reject) => {
                    updateVisibility(visibilityUpdates, {
                        onSuccess: resolve,
                        onError: reject
                    });
                })
            );
        }

        // Save currency changes
        if (selectedCurrency && selectedCurrency !== userSettings?.mainCurrency) {
            promises.push(
                new Promise((resolve, reject) => {
                    updateMainCurrency(selectedCurrency, {
                        onSuccess: resolve,
                        onError: reject
                    });
                })
            );
        }

        // Wait for all saves to complete
        if (promises.length > 0) {
            try {
                await Promise.all(promises);
                setHasChanges(false);
            } catch (error) {
                console.error('Error saving settings:', error);
            }
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const isSaving = isSavingVisibility || isSavingCurrency;

    return (
        <div className="space-y-8">
            {/* Currency Settings Section */}
            <CurrencySettings
                selectedCurrency={selectedCurrency}
                onCurrencyChange={handleCurrencyChange}
                disabled={isSaving}
            />

            {/* Divider */}
            <div className="border-t border-zinc-200 dark:border-zinc-800" />

            {/* Account Visibility Section */}
            <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-medium">Sidebar Appearance</h3>
                    <p className="text-sm text-muted-foreground">
                        Customize what appears in your sidebar.
                    </p>
                </div>

                <div className="space-y-4">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        Bank Accounts
                    </h4>
                    <div className="space-y-2">
                        {accounts.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic">
                                {ACCOUNT_UI.MESSAGES.NO_ACCOUNTS}
                            </p>
                        ) : (
                            accounts.map((account) => (
                                <div
                                    key={account.id}
                                    className="flex items-center space-x-3 p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
                                >
                                    <Checkbox
                                        id={`toggle-${account.id}`}
                                        checked={pendingVisibility[account.id!] ?? true}
                                        onCheckedChange={() => handleToggle(account.id!)}
                                        disabled={isSaving}
                                    />
                                    <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => !isSaving && handleToggle(account.id!)}>
                                        <DollarSign
                                            className="h-4 w-4 flex-shrink-0 text-gray-400"
                                        />
                                        <label
                                            htmlFor={`toggle-${account.id}`}
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                        >
                                            {account.name}
                                        </label>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Single Save Button */}
            <div className="flex justify-end pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <Button
                    onClick={handleSave}
                    disabled={!hasChanges || isSaving}
                    className="w-full sm:w-auto"
                >
                    {isSaving ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                        <Save className="w-4 h-4 mr-2" />
                    )}
                    Save Changes
                </Button>
            </div>
        </div>
    );
}

