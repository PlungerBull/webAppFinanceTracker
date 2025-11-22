'use client';

import { useFormModal } from '@/hooks/shared/use-form-modal';
import { z } from 'zod';
import { useAddCategory } from '../hooks/use-categories';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { ACCOUNT, ACCOUNTS, VALIDATION, CATEGORY } from '@/lib/constants';
import { CategoryForm } from './category-form';
import { FormModal } from '@/components/shared/form-modal';

interface AddCategoryModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// Schema for the form
const categorySchema = z.object({
    name: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.CATEGORY_NAME_REQUIRED),
    color: z.string().regex(ACCOUNT.COLOR_REGEX, ACCOUNTS.MESSAGES.ERROR.VALIDATION_COLOR_INVALID),
});

type CategoryFormData = z.infer<typeof categorySchema>;

export function AddCategoryModal({ open, onOpenChange }: AddCategoryModalProps) {
    const addCategoryMutation = useAddCategory();

    const {
        form,
        error,
        handleClose: resetForm,
        handleSubmit,
    } = useFormModal(categorySchema, async (data: CategoryFormData) => {
        await addCategoryMutation.mutateAsync({
            name: data.name,
            color: data.color,
        });
        onOpenChange(false);
    });

    const {
        register,
        formState: { errors },
        setValue,
        watch,
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
                isSubmitting={form.formState.isSubmitting}
            />
        </FormModal>
    );
}
