'use client';

import { useState, useEffect } from 'react';
import { useAccounts } from '@/features/accounts/hooks/use-accounts';
import { useUpdateAccountVisibility } from '@/features/settings/hooks/use-update-account-visibility';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { DollarSign, Loader2, Save } from 'lucide-react';
import { ACCOUNT_UI } from '@/lib/constants';

export function AppearanceSettings() {
    const { data: accounts = [], isLoading } = useAccounts();
    const { mutate: updateVisibility, isPending: isSaving } = useUpdateAccountVisibility();

    // Local state for pending changes
    // Map of accountId -> isVisible
    const [pendingVisibility, setPendingVisibility] = useState<Record<string, boolean>>({});
    const [hasChanges, setHasChanges] = useState(false);

    // Initialize local state from fetched data
    useEffect(() => {
        if (accounts.length > 0) {
            const initialVisibility: Record<string, boolean> = {};
            accounts.forEach(acc => {
                if (acc.account_id) {
                    // Default to true if undefined, though DB default is true
                    initialVisibility[acc.account_id] = acc.is_visible ?? true;
                }
            });
            setPendingVisibility(initialVisibility);
        }
    }, [accounts]);

    const handleToggle = (accountId: string) => {
        setPendingVisibility((prev) => {
            const newState = { ...prev, [accountId]: !prev[accountId] };

            // Check for changes
            let changed = false;
            for (const acc of accounts) {
                if (acc.account_id && newState[acc.account_id] !== (acc.is_visible ?? true)) {
                    changed = true;
                    break;
                }
            }
            setHasChanges(changed);

            return newState;
        });
    };

    const handleSave = () => {
        const updates = Object.entries(pendingVisibility)
            .filter(([accountId, isVisible]) => {
                const original = accounts.find(a => a.account_id === accountId);
                return original && original.is_visible !== isVisible;
            })
            .map(([accountId, isVisible]) => ({ accountId, isVisible }));

        if (updates.length > 0) {
            updateVisibility(updates, {
                onSuccess: () => setHasChanges(false)
            });
        } else {
            setHasChanges(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // Filter out duplicate accounts (since useAccounts returns balances which might be multiple per account)
    // We only want unique bank accounts
    const uniqueAccounts = Array.from(
        new Map(
            accounts
                .filter((a) => a.account_id) // Ensure account_id exists
                .map((a) => [a.account_id, a])
        ).values()
    );

    return (
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
                    {uniqueAccounts.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">
                            {ACCOUNT_UI.MESSAGES.NO_ACCOUNTS}
                        </p>
                    ) : (
                        uniqueAccounts.map((account) => (
                            <div
                                key={account.account_id}
                                className="flex items-center space-x-3 p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
                            >
                                <Checkbox
                                    id={`toggle-${account.account_id}`}
                                    checked={pendingVisibility[account.account_id!] ?? true}
                                    onCheckedChange={() => handleToggle(account.account_id!)}
                                />
                                <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => handleToggle(account.account_id!)}>
                                    <DollarSign
                                        className="h-4 w-4 flex-shrink-0"
                                        style={{ color: account.color || undefined }}
                                    />
                                    <label
                                        htmlFor={`toggle-${account.account_id}`}
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

            <div className="flex justify-end pt-4">
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
