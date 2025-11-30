'use client';

import { useState, useEffect } from 'react';
import { useDeleteItem } from '@/hooks/shared/use-delete-item';
import { categoriesApi } from '../api/categories';
import { QUERY_KEYS } from '@/lib/constants';
import { CATEGORY } from '@/lib/constants';
import type { Database } from '@/types/database.types';
import { DeleteDialog } from '@/components/shared/delete-dialog';
import { canDeleteParent } from '../utils/validation';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

// Use the view type which includes transaction_count
type Category = Database['public']['Views']['categories_with_counts']['Row'];

interface DeleteCategoryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    category: Category | null;
}

export function DeleteCategoryDialog({
    open,
    onOpenChange,
    category,
}: DeleteCategoryDialogProps) {
    const [isChecking, setIsChecking] = useState(false);
    const [checkError, setCheckError] = useState<string | null>(null);

    const { handleDelete, isDeleting, error: deleteError } = useDeleteItem(
        async (id: string) => {
            return categoriesApi.delete(id);
        },
        [QUERY_KEYS.CATEGORIES]
    );

    useEffect(() => {
        if (open && category) {
            checkDeletability();
        } else {
            setCheckError(null);
        }
    }, [open, category]);

    const checkDeletability = async () => {
        if (!category) return;

        // Only check for parents (parent_id is null)
        if (category.parent_id === null) {
            setIsChecking(true);
            try {
                const result = await canDeleteParent(category.id!);
                if (!result.canDelete) {
                    setCheckError(result.error || "Cannot delete parent category.");
                } else {
                    setCheckError(null);
                }
            } catch (err) {
                console.error("Failed to check category deletability", err);
                setCheckError("Failed to verify if category can be deleted.");
            } finally {
                setIsChecking(false);
            }
        } else {
            setCheckError(null);
        }
    };

    const onDelete = async () => {
        if (category?.id) {
            await handleDelete(category.id);
            onOpenChange(false);
        }
    };

    if (!category) return null;

    // If checking or has error, show a custom dialog content or the DeleteDialog in a specific state
    // But DeleteDialog is a wrapper.
    // If we have a blocking error (has children), we should show an alert dialog instead of the delete confirmation.

    if (isChecking) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent>
                    <div className="flex flex-col items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="mt-2 text-sm text-muted-foreground">Verifying category...</p>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    if (checkError) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="h-5 w-5" />
                            Cannot Delete Category
                        </DialogTitle>
                        <DialogDescription className="pt-2">
                            {checkError}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <DeleteDialog
            open={open}
            onOpenChange={onOpenChange}
            title={CATEGORY.UI.LABELS.DELETE_CATEGORY}
            description={
                <>
                    {CATEGORY.UI.MESSAGES.DELETE_CONFIRMATION}
                    <br />
                    <strong>{category.name}</strong>
                    <br />
                    <span className="text-red-500 mt-2 block">
                        {CATEGORY.UI.MESSAGES.DELETE_WARNING}
                    </span>
                    {(category.transaction_count || 0) > 0 && (
                        <span className="text-red-500 mt-1 block font-semibold">
                            {CATEGORY.UI.MESSAGES.TRANSACTION_COUNT_WARNING(category.transaction_count || 0)}
                        </span>
                    )}
                </>
            }
            onConfirm={onDelete}
            isDeleting={isDeleting}
            error={deleteError}
            confirmLabel={CATEGORY.UI.BUTTONS.DELETE}
            cancelLabel={CATEGORY.UI.BUTTONS.CANCEL}
        />
    );
}
