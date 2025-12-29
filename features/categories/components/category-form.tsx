'use client';

import { UseFormRegister, FieldErrors, UseFormSetValue, UseFormWatch, Controller, Control } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ACCOUNT, CATEGORY } from '@/lib/constants';
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
type Category = Database['public']['Views']['categories_with_counts']['Row'];

export interface CategoryFormData {
    name: string;
    color: string;
    parent_id?: string | null;
}

interface CategoryFormProps {
    register: UseFormRegister<any>;
    errors: FieldErrors<any>;
    setValue: UseFormSetValue<any>;
    watch: UseFormWatch<any>;
    control: Control<any>;
    isSubmitting: boolean;
    availableParents: Category[];
}

export function CategoryForm({
    register,
    errors,
    setValue,
    watch,
    control,
    isSubmitting,
    availableParents,
}: CategoryFormProps) {
    const selectedColor = watch('color');

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
                    <p className="text-sm text-red-600">{errors.name.message as string}</p>
                )}
            </div>

            {/* Parent Category */}
            <div className="space-y-2">
                <Label>{CATEGORY.UI.LABELS.PARENT_CATEGORY || "Parent Category"}</Label>
                <Controller
                    control={control}
                    name="parent_id"
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
                {errors.parent_id && (
                    <p className="text-sm text-red-600">{errors.parent_id.message as string}</p>
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
                    <p className="text-sm text-red-600">{errors.color.message as string}</p>
                )}
            </div>
        </div>
    );
}
