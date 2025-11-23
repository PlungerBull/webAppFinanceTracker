'use client';

import { UseFormRegister, FieldErrors, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ACCOUNT, CATEGORY } from '@/lib/constants';
import { ColorPicker } from '@/components/shared/color-picker';

export interface CategoryFormData {
    name: string;
    color: string;
}

interface CategoryFormProps {
    register: UseFormRegister<any>;
    errors: FieldErrors<any>;
    setValue: UseFormSetValue<any>;
    watch: UseFormWatch<any>;
    isSubmitting: boolean;
}

export function CategoryForm({
    register,
    errors,
    setValue,
    watch,
    isSubmitting,
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
