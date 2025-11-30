'use client';

import { useState } from 'react';
import { useFormModal } from '@/hooks/shared/use-form-modal';
import { z } from 'zod';
import { useUpdateGrouping, useGroupingChildren, useGroupings, useReassignSubcategory } from '../hooks/use-groupings';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ColorPicker } from '@/components/shared/color-picker';
import { ACCOUNT, VALIDATION, GROUPING } from '@/lib/constants';
import { FormModal } from '@/components/shared/form-modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import type { Database } from '@/types/database.types';

type ParentCategory = Database['public']['Views']['parent_categories_with_counts']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

interface EditGroupingModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    grouping: ParentCategory | null;
}

// Schema for the form
const groupingSchema = z.object({
    name: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, GROUPING.UI.MESSAGES.GROUPING_NAME_REQUIRED),
    color: z.string().regex(ACCOUNT.COLOR_REGEX, 'Invalid color format'),
});

type GroupingFormData = z.infer<typeof groupingSchema>;

export function EditGroupingModal({ open, onOpenChange, grouping }: EditGroupingModalProps) {
    const updateGroupingMutation = useUpdateGrouping();
    const reassignSubcategoryMutation = useReassignSubcategory();
    const { data: allGroupings = [] } = useGroupings();
    const { data: children = [] } = useGroupingChildren(grouping?.id || '');

    const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
    const [targetParentId, setTargetParentId] = useState<string>('');
    const [reassigning, setReassigning] = useState(false);

    const {
        form,
        error,
        handleClose: resetForm,
        handleSubmit,
    } = useFormModal(groupingSchema, async (data: GroupingFormData) => {
        if (!grouping) return;

        await updateGroupingMutation.mutateAsync({
            id: grouping.id,
            data: {
                name: data.name,
                color: data.color,
            },
        });
        onOpenChange(false);
    }, {
        defaultValues: {
            name: grouping?.name || '',
            color: grouping?.color || GROUPING.DEFAULT_COLOR,
        },
    });

    const {
        register,
        formState: { errors, isSubmitting },
        setValue,
        watch,
    } = form;

    const selectedColor = watch('color');

    // Filter available parents (exclude current grouping)
    const availableParents = allGroupings.filter(g => g.id !== grouping?.id);

    const handleReassign = async () => {
        if (selectedSubcategories.length === 0) {
            alert(GROUPING.UI.MESSAGES.SELECT_SUBCATEGORIES_WARNING);
            return;
        }
        if (!targetParentId) {
            alert(GROUPING.UI.MESSAGES.SELECT_TARGET_PARENT_WARNING);
            return;
        }

        setReassigning(true);
        try {
            // Reassign all selected subcategories
            for (const childId of selectedSubcategories) {
                await reassignSubcategoryMutation.mutateAsync({
                    childId,
                    newParentId: targetParentId,
                });
            }

            // Reset selection
            setSelectedSubcategories([]);
            setTargetParentId('');
        } catch (error) {
            console.error('Error reassigning subcategories:', error);
        } finally {
            setReassigning(false);
        }
    };

    const handleClose = () => {
        resetForm();
        setSelectedSubcategories([]);
        setTargetParentId('');
        onOpenChange(false);
    };

    if (!grouping) return null;

    return (
        <FormModal
            open={open}
            onOpenChange={handleClose}
            title={GROUPING.UI.LABELS.EDIT_GROUPING}
            description={GROUPING.UI.DESCRIPTIONS.EDIT_GROUPING}
            onSubmit={(e) => void handleSubmit(e)}
            isSubmitting={isSubmitting}
            submitLabel={GROUPING.UI.BUTTONS.UPDATE}
            cancelLabel={GROUPING.UI.BUTTONS.CANCEL}
            error={error}
            maxWidth="sm:max-w-[550px]"
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

            {/* Divider */}
            <div className="border-t border-gray-200 my-4" />

            {/* Subcategory Reassignment Section */}
            <div className="space-y-4">
                <div>
                    <Label className="text-sm font-medium">{GROUPING.UI.LABELS.SUBCATEGORIES}</Label>
                    <p className="text-xs text-gray-500 mt-1">
                        {GROUPING.UI.DESCRIPTIONS.REASSIGN_SUBCATEGORIES}
                    </p>
                </div>

                {children.length === 0 ? (
                    <div className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-md">
                        {GROUPING.UI.MESSAGES.NO_SUBCATEGORIES}
                    </div>
                ) : (
                    <>
                        {/* Multi-select for subcategories */}
                        <div className="space-y-2">
                            <Label className="text-xs">{GROUPING.UI.LABELS.SELECT_SUBCATEGORIES}</Label>
                            <div className="border border-gray-200 rounded-md p-3 max-h-[150px] overflow-y-auto space-y-2">
                                {children.map((child) => (
                                    <div key={child.id} className="flex items-center gap-2">
                                        <Checkbox
                                            id={`child-${child.id}`}
                                            checked={selectedSubcategories.includes(child.id)}
                                            onCheckedChange={(checked) => {
                                                if (checked) {
                                                    setSelectedSubcategories([...selectedSubcategories, child.id]);
                                                } else {
                                                    setSelectedSubcategories(selectedSubcategories.filter(id => id !== child.id));
                                                }
                                            }}
                                        />
                                        <Label
                                            htmlFor={`child-${child.id}`}
                                            className="text-sm font-normal cursor-pointer flex-1"
                                        >
                                            {child.name}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Target parent selector */}
                        <div className="space-y-2">
                            <Label className="text-xs">{GROUPING.UI.LABELS.SELECT_TARGET_PARENT}</Label>
                            <Select value={targetParentId} onValueChange={setTargetParentId}>
                                <SelectTrigger>
                                    <SelectValue placeholder={GROUPING.UI.LABELS.REASSIGN_PARENT} />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableParents.map((parent) => (
                                        <SelectItem key={parent.id} value={parent.id}>
                                            {parent.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Reassign button */}
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={handleReassign}
                            disabled={reassigning || selectedSubcategories.length === 0 || !targetParentId}
                            className="w-full"
                        >
                            {reassigning ? 'Reassigning...' : GROUPING.UI.BUTTONS.REASSIGN}
                        </Button>
                    </>
                )}
            </div>
        </FormModal>
    );
}
