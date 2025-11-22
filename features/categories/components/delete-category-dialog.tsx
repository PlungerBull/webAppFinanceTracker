'use client';

import { useState } from 'react';
import { useDeleteCategory } from '../hooks/use-categories';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { CATEGORY } from '@/lib/constants';
import type { Database } from '@/types/database.types';

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
    const [isDeleting, setIsDeleting] = useState(false);
    const deleteCategoryMutation = useDeleteCategory();

    const handleDelete = async () => {
        if (!category) return;

        try {
            setIsDeleting(true);
            if (category.id) {
                await deleteCategoryMutation.mutateAsync(category.id);
            }
            onOpenChange(false);
        } catch (error) {
            console.error(CATEGORY.API.CONSOLE.DELETE_CATEGORY_FAILED, error);
            // Ideally show error toast here
        } finally {
            setIsDeleting(false);
        }
    };

    if (!category) return null;

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{CATEGORY.UI.LABELS.DELETE_CATEGORY}</AlertDialogTitle>
                    <AlertDialogDescription>
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
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>{CATEGORY.UI.BUTTONS.CANCEL}</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            handleDelete();
                        }}
                        disabled={isDeleting}
                        className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                    >
                        {isDeleting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {CATEGORY.UI.BUTTONS.DELETE}...
                            </>
                        ) : (
                            CATEGORY.UI.BUTTONS.DELETE
                        )}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
