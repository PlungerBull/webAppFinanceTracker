'use client';

import { useFormModal } from '@/hooks/shared/use-form-modal';
import { z } from 'zod';
import { useAddCategory, useCategories } from '../hooks/use-categories';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { ACCOUNT, ACCOUNTS, VALIDATION, CATEGORY } from '@/lib/constants';
import { CategoryForm } from './category-form';
import { FormModal } from '@/components/shared/form-modal';
import { validateCategoryHierarchy } from '../utils/validation';

interface AddCategoryModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// Schema for the form
const categorySchema = z.object({
    name: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.CATEGORY_NAME_REQUIRED),
    color: z.string().regex(ACCOUNT.COLOR_REGEX, ACCOUNTS.MESSAGES.ERROR.VALIDATION_COLOR_INVALID),
    parent_id: z.string().nullable().optional(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

export function AddCategoryModal({ open, onOpenChange }: AddCategoryModalProps) {
    const addCategoryMutation = useAddCategory();
    const { data: categories = [] } = useCategories();

    // Filter potential parents: only categories that are themselves parents (parent_id is null)
    const availableParents = categories.filter(c => c.parent_id === null);

    const {
        form,
        error,
        handleClose: resetForm,
        handleSubmit,
        setError,
    } = useFormModal(categorySchema, async (data: CategoryFormData) => {
        // Client-side validation
        const validation = await validateCategoryHierarchy(undefined, data.parent_id || null);
        if (!validation.valid) {
            setError(validation.error || "Validation failed");
            return; // Stop submission
        }

        await addCategoryMutation.mutateAsync({
            name: data.name,
            color: data.color,
            parent_id: data.parent_id || null,
        });
        onOpenChange(false);
    });

    const {
        register,
        formState: { errors },
        setValue,
        watch,
        control,
    } = form;

    const handleClose = () => {
        resetForm();
        onOpenChange(false);
    };

    return (
        <FormModal
            open={open}
            onOpenChange={handleClose}
            title={CATEGORY.UI.LABELS.CREATE_CATEGORY}
            description={CATEGORY.UI.DESCRIPTIONS.CREATE_CATEGORY}
            onSubmit={(e) => void handleSubmit(e)}
            isSubmitting={form.formState.isSubmitting}
            submitLabel={CATEGORY.UI.BUTTONS.CREATE}
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
