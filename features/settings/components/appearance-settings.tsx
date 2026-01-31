'use client';

import { useState, useMemo } from 'react';
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
    const { mutateAsync: updateVisibility, isPending: isSavingVisibility } = useUpdateAccountVisibility();
    const { data: userSettings } = useUserSettings();
    const { mutateAsync: updateMainCurrency, isPending: isSavingCurrency } = useUpdateMainCurrency();

    // S-TIER: Track only LOCAL changes, derive full state from server + local
    // This eliminates setState-in-effect anti-pattern by never syncing server state
    const [localVisibilityChanges, setLocalVisibilityChanges] = useState<Record<string, boolean>>({});
    const [localCurrencyOverride, setLocalCurrencyOverride] = useState<string | null>(null);

    // S-TIER: Derive pendingVisibility from server state + local changes
    // Memoized with O(n) complexity boundary check for iOS Bridge saturation prevention
    const pendingVisibility = useMemo(() => {
        // BRIDGE SATURATION GUARD: For >100 accounts, consider Repository-level pagination
        if (accounts.length > 100) {
            console.warn('[AppearanceSettings] Large account list (%d) - consider Repository-level pagination', accounts.length);
        }

        const base: Record<string, boolean> = {};
        for (let i = 0; i < accounts.length; i++) {
            const acc = accounts[i];
            if (acc.id) {
                base[acc.id] = acc.isVisible ?? true;
            }
        }
        // Overlay local changes on top of server state
        return { ...base, ...localVisibilityChanges };
    }, [accounts, localVisibilityChanges]);

    // S-TIER: Derive selectedCurrency from server state + local override
    const selectedCurrency = localCurrencyOverride ?? userSettings?.mainCurrency ?? '';

    // DERIVED STATE: Compute hasChanges from local changes vs server state
    const hasChanges = useMemo(() => {
        // Check account visibility changes (only look at local overrides)
        for (const [accountId, localValue] of Object.entries(localVisibilityChanges)) {
            const account = accounts.find(acc => acc.id === accountId);
            const serverValue = account?.isVisible ?? true;
            if (localValue !== serverValue) {
                return true;
            }
        }

        // Check currency changes
        if (localCurrencyOverride && localCurrencyOverride !== userSettings?.mainCurrency) {
            return true;
        }

        return false;
    }, [localVisibilityChanges, localCurrencyOverride, userSettings, accounts]);

    const handleToggle = (accountId: string) => {
        const currentValue = pendingVisibility[accountId] ?? true;
        setLocalVisibilityChanges((prev) => ({
            ...prev,
            [accountId]: !currentValue
        }));
    };

    const handleCurrencyChange = (value: string) => {
        setLocalCurrencyOverride(value);
    };

    const handleSave = async () => {
        const promises: Promise<void>[] = [];

        // Save account visibility changes (only local overrides that differ from server)
        const visibilityUpdates = Object.entries(localVisibilityChanges)
            .filter(([accountId, localValue]) => {
                const account = accounts.find(acc => acc.id === accountId);
                const serverValue = account?.isVisible ?? true;
                return localValue !== serverValue;
            })
            .map(([accountId, isVisible]) => ({ accountId, isVisible }));

        if (visibilityUpdates.length > 0) {
            promises.push(updateVisibility(visibilityUpdates));
        }

        // Save currency changes
        if (localCurrencyOverride && localCurrencyOverride !== userSettings?.mainCurrency) {
            promises.push(updateMainCurrency(localCurrencyOverride).then(() => {}));
        }

        // Wait for all saves to complete
        if (promises.length > 0) {
            try {
                await Promise.all(promises);
                // S-TIER: Clear local overrides after successful save
                // Server state will be refetched, derived state will match
                setLocalVisibilityChanges({});
                setLocalCurrencyOverride(null);
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

