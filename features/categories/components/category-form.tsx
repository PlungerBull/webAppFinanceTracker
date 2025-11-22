'use client';

import { UseFormRegister, FieldErrors, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCOUNT, CATEGORY } from '@/lib/constants';

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
    const colorPalette = ACCOUNT.COLOR_PALETTE;

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
                <div className="flex flex-wrap gap-2 items-center">
                    {/* Color Palette */}
                    {colorPalette.map((color) => (
                        <button
                            key={color}
                            type="button"
                            onClick={() => setValue('color', color, { shouldDirty: true })}
                            disabled={isSubmitting}
                            style={{ backgroundColor: color }}
                            className={cn(
                                'w-8 h-8 rounded-full border-2 transition-all',
                                selectedColor === color
                                    ? 'border-zinc-900 dark:border-zinc-100 ring-2 ring-offset-2 ring-zinc-900 dark:ring-zinc-100'
                                    : 'border-transparent'
                            )}
                            aria-label={CATEGORY.UI.LABELS.SELECT_COLOR_ARIA(color)}
                        />
                    ))}

                    {/* Custom Color Picker */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <button
                                type="button"
                                disabled={isSubmitting}
                                className="w-8 h-8 rounded-full border-2 border-zinc-300 dark:border-zinc-700 flex items-center justify-center bg-gradient-to-br from-red-500 via-green-500 to-blue-500 hover:border-zinc-900 dark:hover:border-zinc-100 transition-all"
                            >
                                <Plus className="w-4 h-4 text-white drop-shadow-md" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-3" align="start">
                            <div className="space-y-2">
                                <Label htmlFor="custom-color" className="text-sm">{CATEGORY.UI.LABELS.CUSTOM_COLOR}</Label>
                                <div className="flex gap-2 items-center">
                                    <Input
                                        id="custom-color"
                                        type="color"
                                        value={selectedColor}
                                        onChange={(e) => setValue('color', e.target.value, { shouldDirty: true })}
                                        disabled={isSubmitting}
                                        className="w-16 h-10 cursor-pointer"
                                    />
                                    <Input
                                        type="text"
                                        value={selectedColor}
                                        onChange={(e) => setValue('color', e.target.value, { shouldDirty: true })}
                                        disabled={isSubmitting}
                                        placeholder={ACCOUNT.DEFAULT_COLOR}
                                        className="flex-1 font-mono text-xs"
                                        maxLength={ACCOUNT.COLOR_INPUT.MAX_LENGTH}
                                    />
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
                {errors.color && (
                    <p className="text-sm text-red-600">{errors.color.message as string}</p>
                )}
            </div>
        </div>
    );
}
