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
            await deleteCategoryMutation.mutateAsync(category.id);
            onOpenChange(false);
        } catch (error) {
            console.error('Failed to delete category:', error);
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
                    <AlertDialogTitle>Delete Category</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete <strong>{category.name}</strong>?
                        {category.transaction_count > 0 && (
                            <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-md text-sm">
                                ⚠️ This category has <strong>{category.transaction_count}</strong> associated transactions.
                                Deleting it will remove the category from these transactions.
                            </div>
                        )}
                        <div className="mt-2">This action cannot be undone.</div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
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
                                Deleting...
                            </>
                        ) : (
                            'Delete'
                        )}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
