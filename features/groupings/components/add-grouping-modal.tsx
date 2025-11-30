'use client';

import { useFormModal } from '@/hooks/shared/use-form-modal';
import { z } from 'zod';
import { useAddGrouping } from '../hooks/use-groupings';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ColorPicker } from '@/components/shared/color-picker';
import { ACCOUNT, VALIDATION, GROUPING } from '@/lib/constants';
import { FormModal } from '@/components/shared/form-modal';

interface AddGroupingModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// Schema for the form
const groupingSchema = z.object({
    name: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, GROUPING.UI.MESSAGES.GROUPING_NAME_REQUIRED),
    color: z.string().regex(ACCOUNT.COLOR_REGEX, 'Invalid color format'),
});

type GroupingFormData = z.infer<typeof groupingSchema>;

export function AddGroupingModal({ open, onOpenChange }: AddGroupingModalProps) {
    const addGroupingMutation = useAddGrouping();

    const {
        form,
        error,
        handleClose: resetForm,
        handleSubmit,
    } = useFormModal(groupingSchema, async (data: GroupingFormData) => {
        await addGroupingMutation.mutateAsync({
            name: data.name,
            color: data.color,
        });
        onOpenChange(false);
    }, {
        defaultValues: {
            name: '',
            color: GROUPING.DEFAULT_COLOR,
        },
    });

    const {
        register,
        formState: { errors, isSubmitting },
        setValue,
        watch,
    } = form;

    const selectedColor = watch('color');

    const handleClose = () => {
        resetForm();
        onOpenChange(false);
    };

    return (
        <FormModal
            open={open}
            onOpenChange={handleClose}
            title={GROUPING.UI.LABELS.CREATE_GROUPING}
            description={GROUPING.UI.DESCRIPTIONS.CREATE_GROUPING}
            onSubmit={(e) => void handleSubmit(e)}
            isSubmitting={isSubmitting}
            submitLabel={GROUPING.UI.BUTTONS.CREATE}
            cancelLabel={GROUPING.UI.BUTTONS.CANCEL}
            error={error}
        >
            {/* Grouping Name */}
            <div className="space-y-2">
                <Label htmlFor="name">{GROUPING.UI.LABELS.GROUPING_NAME}</Label>
                <Input
                    id="name"
                    type="text"
                    placeholder={GROUPING.UI.LABELS.GROUPING_NAME_PLACEHOLDER}
                    {...register('name')}
                    disabled={isSubmitting}
                />
                {errors.name && (
                    <p className="text-sm text-red-600">{errors.name.message as string}</p>
                )}
            </div>

            {/* Grouping Color */}
            <div className="space-y-2">
                <Label>{GROUPING.UI.LABELS.GROUPING_COLOR}</Label>
                <ColorPicker
                    value={selectedColor}
                    onChange={(color) => setValue('color', color, { shouldDirty: true })}
                    disabled={isSubmitting}
                    allowNoColor={false}
                />
                {errors.color && (
                    <p className="text-sm text-red-600">{errors.color.message as string}</p>
                )}
            </div>
        </FormModal>
    );
}
