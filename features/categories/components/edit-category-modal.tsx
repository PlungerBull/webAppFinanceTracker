'use client';

import { useEffect } from 'react';
import { useFormModal } from '@/hooks/shared/use-form-modal';
import { z } from 'zod';
import { useUpdateCategory } from '../hooks/use-categories';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { ACCOUNT, ACCOUNTS, VALIDATION, CATEGORY } from '@/lib/constants';
import type { Database } from '@/types/database.types';
import { CategoryForm } from './category-form';
import { FormModal } from '@/components/shared/form-modal';

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
    const updateCategoryMutation = useUpdateCategory();

    const {
        form,
        error,
        handleClose: resetForm,
        handleSubmit,
    } = useFormModal(categorySchema, async (data: CategoryFormData) => {
        if (!category?.id) return;

        await updateCategoryMutation.mutateAsync({
            id: category.id,
            data: {
                name: data.name,
                color: data.color,
            },
        });
        onOpenChange(false);
    });

    const {
        register,
        formState: { errors },
        reset,
        setValue,
        watch,
    } = form;

    useEffect(() => {
        if (category) {
            reset({
                name: category.name || '',
                color: category.color || '',
            });
        }
    }, [category, reset]);

    const handleClose = () => {
        resetForm();
        onOpenChange(false);
    };

    return (
        <FormModal
            open={open}
            onOpenChange={handleClose}
            title={CATEGORY.UI.LABELS.EDIT_CATEGORY}
            description={CATEGORY.UI.DESCRIPTIONS.EDIT_CATEGORY}
            onSubmit={(e) => void handleSubmit(e)}
            isSubmitting={form.formState.isSubmitting}
            submitLabel={CATEGORY.UI.BUTTONS.UPDATE}
            cancelLabel={CATEGORY.UI.BUTTONS.CANCEL}
            error={error}
        >
            {/* Category Form Fields */}
            <CategoryForm
                register={register}
                errors={errors}
                setValue={setValue}
                watch={watch}
                isSubmitting={form.formState.isSubmitting}
            />
        </FormModal>
    );
}
