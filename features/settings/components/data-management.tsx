'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Upload, Download, Trash2, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { IMPORT_EXPORT, SETTINGS, QUERY_KEYS } from '@/lib/constants';

export function DataManagement() {
    const router = useRouter();
    const [importError, setImportError] = useState<string | null>(null);
    const [importSuccess, setImportSuccess] = useState<string | null>(null);
    const supabase = createClient();
    const queryClient = useQueryClient();

    const handleClearData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase.rpc('clear_user_data', { p_user_id: user.id });
            if (error) throw error;

            alert(SETTINGS.MESSAGES.SUCCESS.DATA_CLEARED);

            // Invalidate all data queries
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRANSACTIONS.ALL }),
                queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS }),
                queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES }),
                queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CURRENCIES }),
            ]);

            router.refresh();
        } catch (error) {
            console.error('Failed to clear data:', error);
            alert(SETTINGS.MESSAGES.ERROR.CLEAR_FAILED);
        }
    };

    return (
        <div className="space-y-8">
            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-6">
                <h3 className="text-xl font-semibold mb-1">{SETTINGS.HEADERS.DATA}</h3>
                <p className="text-sm text-muted-foreground">
                    {SETTINGS.DESCRIPTIONS.DATA}
                </p>
            </div>

            {/* Import Section */}
            <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{SETTINGS.HEADERS.IMPORT_EXPORT}</h4>

                <div className="grid gap-4">
                    <div className="flex items-start justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
                        <div className="space-y-1">
                            <div className="font-medium flex items-center gap-2">
                                <Upload className="h-4 w-4" />
                                {SETTINGS.LABELS.IMPORT_DATA}
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {SETTINGS.DESCRIPTIONS.IMPORT}
                            </p>
                        </div>
                        <div className="relative">
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;

                                    try {
                                        setImportSuccess(null);
                                        setImportError(null);
                                        const { DataImportService } = await import('@/features/import-export/services/data-import-service');
                                        const service = new DataImportService();
                                        const result = await service.importFromExcel(file);

                                        if (result.failed > 0) {
                                            setImportError(SETTINGS.MESSAGES.ERROR.IMPORT_ERRORS(result.success, result.failed, result.errors));
                                        } else {
                                            setImportSuccess(SETTINGS.MESSAGES.SUCCESS.IMPORT_SUCCESS(result.success));
                                            // Invalidate all data queries to reflect imported data
                                            await Promise.all([
                                                queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRANSACTIONS.ALL }),
                                                queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS }),
                                                queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES }),
                                                queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CURRENCIES }),
                                            ]);
                                        }
                                        e.target.value = '';
                                    } catch (err) {
                                        setImportError(err instanceof Error ? err.message : SETTINGS.MESSAGES.ERROR.IMPORT_FAILED);
                                        e.target.value = '';
                                    }
                                }}
                            />
                            <Button variant="secondary" size="sm">
                                {SETTINGS.BUTTONS.SELECT_FILE}
                            </Button>
                        </div>
                    </div>
                    {importError && (
                        <div className="text-sm text-red-600 bg-white border border-red-200 p-2 rounded">{importError}</div>
                    )}
                    {importSuccess && (
                        <div className="text-sm text-green-600 bg-white border border-green-200 p-2 rounded">{importSuccess}</div>
                    )}

                    {/* Import Instructions Warning */}
                    <div className="rounded-lg border border-amber-200 bg-white dark:border-amber-900/30 dark:bg-amber-900/10 p-4">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                            <div className="space-y-3 text-sm">
                                <div>
                                    <h5 className="font-medium text-amber-800 dark:text-amber-400 mb-1">{SETTINGS.LABELS.FILE_STRUCTURE_REQ}</h5>
                                    <p className="text-amber-700 dark:text-amber-500/90">
                                        {SETTINGS.MESSAGES.FILE_STRUCTURE_INTRO(IMPORT_EXPORT.FILE_TYPES.join(', '))}
                                    </p>
                                </div>

                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div>
                                        <span className="font-semibold text-amber-800 dark:text-amber-400 block mb-1">{SETTINGS.LABELS.REQUIRED_COLUMNS}</span>
                                        <ul className="list-disc pl-4 space-y-0.5 text-amber-700 dark:text-amber-500/90">
                                            {IMPORT_EXPORT.REQUIRED_COLUMNS.map(col => (
                                                <li key={col}>{col}</li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div>
                                        <span className="font-semibold text-amber-800 dark:text-amber-400 block mb-1">{SETTINGS.LABELS.OPTIONAL_COLUMNS}</span>
                                        <ul className="list-disc pl-4 space-y-0.5 text-amber-700 dark:text-amber-500/90">
                                            {IMPORT_EXPORT.OPTIONAL_COLUMNS.map(col => (
                                                <li key={col}>{col}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-start justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
                        <div className="space-y-1">
                            <div className="font-medium flex items-center gap-2">
                                <Download className="h-4 w-4" />
                                {SETTINGS.LABELS.EXPORT_DATA}
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {SETTINGS.DESCRIPTIONS.EXPORT}
                            </p>
                        </div>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={async () => {
                                try {
                                    const { DataExportService } = await import('@/features/import-export/services/data-export-service');
                                    const service = new DataExportService();
                                    await service.exportToExcel();
                                } catch (err) {
                                    alert(SETTINGS.MESSAGES.ERROR.EXPORT_FAILED);
                                }
                            }}
                        >
                            {SETTINGS.BUTTONS.DOWNLOAD}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

            {/* Clear Data Section */}
            <div className="space-y-4">
                <h4 className="text-sm font-medium text-red-600 uppercase tracking-wider">{SETTINGS.HEADERS.DANGER_ZONE}</h4>

                <div className="flex items-start justify-between p-4 rounded-lg border border-red-200 dark:border-red-900/20 bg-white dark:bg-red-900/10">
                    <div className="space-y-1">
                        <div className="font-medium text-red-700 dark:text-red-400 flex items-center gap-2">
                            <Trash2 className="h-4 w-4" />
                            {SETTINGS.LABELS.CLEAR_ALL_DATA}
                        </div>
                        <p className="text-sm text-red-600/80 dark:text-red-400/80">
                            {SETTINGS.DESCRIPTIONS.CLEAR_DATA}
                        </p>
                    </div>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                                {SETTINGS.BUTTONS.CLEAR_DATA}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                                    <AlertTriangle className="h-5 w-5" />
                                    {SETTINGS.LABELS.CLEAR_ALL_DATA_QUESTION}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    {SETTINGS.DESCRIPTIONS.CLEAR_DATA_CONFIRM}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>{SETTINGS.BUTTONS.CANCEL}</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleClearData}
                                    className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                                >
                                    {SETTINGS.BUTTONS.CONFIRM_DELETE}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>
        </div>
    );
}
