'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAddCategory } from '../hooks/use-categories';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { ACCOUNT, VALIDATION, CATEGORY } from '@/lib/constants';
import { CategoryForm } from './category-form';

interface AddCategoryModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// Schema for the form
const categorySchema = z.object({
    name: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, 'Category name is required'),
    color: z.string().regex(ACCOUNT.COLOR_REGEX, 'Invalid color format'),
});

type CategoryFormData = z.infer<typeof categorySchema>;

export function AddCategoryModal({ open, onOpenChange }: AddCategoryModalProps) {
    const [error, setError] = useState<string | null>(null);
    const addCategoryMutation = useAddCategory();

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

    const onSubmit = async (data: CategoryFormData) => {
        try {
            setError(null);
            await addCategoryMutation.mutateAsync({
                name: data.name,
                color: data.color,
            });
            handleClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create category');
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
                    <DialogTitle>{CATEGORY.UI.LABELS.CREATE_CATEGORY}</DialogTitle>
                    <DialogDescription>
                        Create a new category to organize your transactions
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
                                    {CATEGORY.UI.BUTTONS.CREATE}...
                                </>
                            ) : (
                                CATEGORY.UI.BUTTONS.CREATE
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
