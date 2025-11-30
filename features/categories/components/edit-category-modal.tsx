'use client';

import { useEffect } from 'react';
import { useFormModal } from '@/hooks/shared/use-form-modal';
import { z } from 'zod';
import { useUpdateCategory, useCategories } from '../hooks/use-categories';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { ACCOUNT, ACCOUNTS, VALIDATION, CATEGORY } from '@/lib/constants';
import type { Database } from '@/types/database.types';
import { CategoryForm } from './category-form';
import { FormModal } from '@/components/shared/form-modal';
import { validateCategoryHierarchy } from '../utils/validation';

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
    parent_id: z.string().nullable().optional(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

export function EditCategoryModal({ open, onOpenChange, category }: EditCategoryModalProps) {
    const updateCategoryMutation = useUpdateCategory();
    const { data: categories = [] } = useCategories();

    // Filter potential parents:
    // 1. Must be a parent (parent_id is null)
    // 2. Cannot be itself (if editing a parent)
    // 3. Cannot be a child of itself (if editing a parent, but we only show parents anyway)
    const availableParents = categories.filter(c =>
        c.parent_id === null &&
        c.id !== category?.id
    );

    const {
        form,
        error,
        handleClose: resetForm,
        handleSubmit,
        setError,
    } = useFormModal(categorySchema, async (data: CategoryFormData) => {
        if (!category?.id) return;

        // Client-side validation
        const validation = await validateCategoryHierarchy(category.id, data.parent_id || null);
        if (!validation.valid) {
            setError(validation.error || "Validation failed");
            return; // Stop submission
        }

        await updateCategoryMutation.mutateAsync({
            id: category.id,
            data: {
                name: data.name,
                color: data.color,
                parent_id: data.parent_id || null,
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
        control,
    } = form;

    useEffect(() => {
        if (category) {
            reset({
                name: category.name || '',
                color: category.color || '',
                parent_id: category.parent_id,
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
                control={control}
                isSubmitting={form.formState.isSubmitting}
                availableParents={availableParents}
            />
        </FormModal>
    );
}
