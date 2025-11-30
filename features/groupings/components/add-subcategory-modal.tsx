'use client';

import { useFormModal } from '@/hooks/shared/use-form-modal';
import { z } from 'zod';
import { useAddSubcategory } from '../hooks/use-groupings';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Hash } from 'lucide-react';
import { VALIDATION, GROUPING } from '@/lib/constants';
import { FormModal } from '@/components/shared/form-modal';
import type { Database } from '@/types/database.types';

type ParentCategory = Database['public']['Views']['parent_categories_with_counts']['Row'];

interface AddSubcategoryModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    parentGrouping: ParentCategory | null;
}

// Schema for the form
const subcategorySchema = z.object({
    name: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, GROUPING.UI.MESSAGES.SUBCATEGORY_NAME_REQUIRED),
});

type SubcategoryFormData = z.infer<typeof subcategorySchema>;

export function AddSubcategoryModal({ open, onOpenChange, parentGrouping }: AddSubcategoryModalProps) {
    const addSubcategoryMutation = useAddSubcategory();

    const {
        form,
        error,
        handleClose: resetForm,
        handleSubmit,
    } = useFormModal(subcategorySchema, async (data: SubcategoryFormData) => {
        if (!parentGrouping) return;

        await addSubcategoryMutation.mutateAsync({
            name: data.name,
            parentId: parentGrouping.id,
            color: parentGrouping.color, // Inherit parent color
        });
        onOpenChange(false);
    }, {
        defaultValues: {
            name: '',
        },
    });

    const {
        register,
        formState: { errors, isSubmitting },
    } = form;

    const handleClose = () => {
        resetForm();
        onOpenChange(false);
    };

    if (!parentGrouping) return null;

    return (
        <FormModal
            open={open}
            onOpenChange={handleClose}
            title={GROUPING.UI.LABELS.CREATE_SUBCATEGORY}
            description={GROUPING.UI.DESCRIPTIONS.CREATE_SUBCATEGORY(parentGrouping.name)}
            onSubmit={(e) => void handleSubmit(e)}
            isSubmitting={isSubmitting}
            submitLabel={GROUPING.UI.BUTTONS.CREATE_SUBCATEGORY}
            cancelLabel={GROUPING.UI.BUTTONS.CANCEL}
            error={error}
        >
            {/* Parent Context - Display Only */}
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                    {GROUPING.UI.LABELS.SUBCATEGORY_OF}
                </p>
                <div className="flex items-center gap-2">
                    <Hash
                        className="h-4 w-4"
                        style={{ color: parentGrouping.color || GROUPING.DEFAULT_COLOR }}
                    />
                    <span className="text-sm font-medium text-gray-900">
                        {parentGrouping.name}
                    </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    Color will be inherited from parent
                </p>
            </div>

            {/* Subcategory Name */}
            <div className="space-y-2">
                <Label htmlFor="name">{GROUPING.UI.LABELS.SUBCATEGORY_NAME}</Label>
                <Input
                    id="name"
                    type="text"
                    placeholder={GROUPING.UI.LABELS.SUBCATEGORY_NAME_PLACEHOLDER}
                    {...register('name')}
                    disabled={isSubmitting}
                    autoFocus
                />
                {errors.name && (
                    <p className="text-sm text-red-600">{errors.name.message as string}</p>
                )}
            </div>
        </FormModal>
    );
}
