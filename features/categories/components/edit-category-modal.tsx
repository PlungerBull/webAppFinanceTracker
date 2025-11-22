'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUpdateCategory } from '../hooks/use-categories';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { ACCOUNT, ACCOUNTS, VALIDATION, CATEGORY } from '@/lib/constants';
import type { Database } from '@/types/database.types';
import { CategoryForm } from './category-form';

// Use the view type which includes transaction_count
type Category = Database['public']['Views']['categories_with_counts']['Row'];

interface EditCategoryModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    category: Category | null;
}

// Schema for the form
const categorySchema = z.object({
    name: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.CATEGORY_NAME_REQUIRED),
    color: z.string().regex(ACCOUNT.COLOR_REGEX, ACCOUNTS.MESSAGES.ERROR.VALIDATION_COLOR_INVALID),
});

type CategoryFormData = z.infer<typeof categorySchema>;

export function EditCategoryModal({ open, onOpenChange, category }: EditCategoryModalProps) {
    const [error, setError] = useState<string | null>(null);
    const updateCategoryMutation = useUpdateCategory();

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset,
        setValue,
        watch,
    } = useForm<CategoryFormData>({
        resolver: zodResolver(categorySchema),
        defaultValues: {
            color: ACCOUNT.DEFAULT_COLOR,
        },
    });

    const selectedColor = watch('color');

    useEffect(() => {
        if (category) {
            reset({
                name: category.name || '',
                color: category.color || '',
            });
        }
    }, [category, reset]);

    const onSubmit = async (data: CategoryFormData) => {
        if (!category) return;

        try {
            setError(null);
            if (category.id) {
                await updateCategoryMutation.mutateAsync({
                    id: category.id,
                    data: {
                        name: data.name,
                        color: data.color,
                    },
                });
            }
            handleClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : CATEGORY.API.ERRORS.UPDATE_FAILED);
        }
    };

    const handleClose = () => {
        reset();
        setError(null);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{CATEGORY.UI.LABELS.EDIT_CATEGORY}</DialogTitle>
                    <DialogDescription>
                        {CATEGORY.UI.DESCRIPTIONS.EDIT_CATEGORY}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {error && (
                        <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md">
                            {error}
                        </div>
                    )}

                    {/* Category Form Fields */}
                    <CategoryForm
                        register={register}
                        errors={errors}
                        setValue={setValue}
                        watch={watch}
                        isSubmitting={isSubmitting}
                    />

                    {/* Form Actions */}
                    <div className="flex gap-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={isSubmitting}
                            className="flex-1"
                        >
                            {CATEGORY.UI.BUTTONS.CANCEL}
                        </Button>
                        <Button type="submit" disabled={isSubmitting} className="flex-1">
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {CATEGORY.UI.BUTTONS.UPDATE}...
                                </>
                            ) : (
                                CATEGORY.UI.BUTTONS.UPDATE
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
