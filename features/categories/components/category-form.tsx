'use client';

import { UseFormRegister, FieldErrors, UseFormSetValue, Controller, Control, useWatch } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CATEGORY } from '@/lib/constants';
import { ColorPicker } from '@/components/shared/color-picker';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { Database } from '@/types/supabase';

// Use the view type which includes transaction_count
type ParentCategory = Database['public']['Views']['categories_with_counts']['Row'];

/**
 * Category Form Data Shape
 *
 * CTO Standard: Explicit types for form data - no `any` types.
 * Uses camelCase to match domain DTOs.
 */
export interface CategoryFormData {
    name: string;
    color: string;
    parentId?: string | null;
}

/**
 * Category Form Props
 *
 * Uses typed react-hook-form utilities with CategoryFormData.
 */
interface CategoryFormProps {
    register: UseFormRegister<CategoryFormData>;
    errors: FieldErrors<CategoryFormData>;
    setValue: UseFormSetValue<CategoryFormData>;
    control: Control<CategoryFormData>;
    isSubmitting: boolean;
    availableParents: ParentCategory[];
}

export function CategoryForm({
    register,
    errors,
    setValue,
    control,
    isSubmitting,
    availableParents,
}: CategoryFormProps) {
    const selectedColor = useWatch({
        control,
        name: 'color',
        defaultValue: CATEGORY.DEFAULT_COLOR,
    });

    return (
        <div className="space-y-4">
            {/* Category Name */}
            <div className="space-y-2">
                <Label htmlFor="name">{CATEGORY.UI.LABELS.CATEGORY_NAME}</Label>
                <Input
                    id="name"
                    type="text"
                    placeholder={CATEGORY.UI.LABELS.CATEGORY_NAME_PLACEHOLDER}
                    {...register('name')}
                    disabled={isSubmitting}
                />
                {errors.name && (
                    <p className="text-sm text-red-600">{errors.name.message}</p>
                )}
            </div>

            {/* Parent Category */}
            <div className="space-y-2">
                <Label>{CATEGORY.UI.LABELS.PARENT_CATEGORY || "Parent Category"}</Label>
                <Controller
                    control={control}
                    name="parentId"
                    render={({ field }) => (
                        <Select
                            onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                            value={field.value || "none"}
                            disabled={isSubmitting}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select a parent category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">
                                    <span className="text-zinc-500 italic">None (Top-level Category)</span>
                                </SelectItem>
                                {availableParents.map((parent) => (
                                    <SelectItem key={parent.id} value={parent.id!}>
                                        {parent.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
                {errors.parentId && (
                    <p className="text-sm text-red-600">{errors.parentId.message}</p>
                )}
                <p className="text-xs text-zinc-500">
                    Top-level categories can have subcategories. Transactions can only be assigned to subcategories.
                </p>
            </div>

            {/* Category Color */}
            <div className="space-y-2">
                <Label>{CATEGORY.UI.LABELS.COLOR}</Label>
                <ColorPicker
                    value={selectedColor}
                    onChange={(color) => setValue('color', color, { shouldDirty: true })}
                    disabled={isSubmitting}
                    allowNoColor={false}
                />
                {errors.color && (
                    <p className="text-sm text-red-600">{errors.color.message}</p>
                )}
            </div>
        </div>
    );
}
