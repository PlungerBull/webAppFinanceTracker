'use client';

import { UseFormRegister, FieldErrors, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCOUNT, ACCOUNTS } from '@/lib/constants';

export interface AccountFormData {
    name: string;
    color: string;
}

interface AccountFormProps {
    register: UseFormRegister<any>;
    errors: FieldErrors<any>;
    setValue: UseFormSetValue<any>;
    watch: UseFormWatch<any>;
    isSubmitting: boolean;
}

export function AccountForm({
    register,
    errors,
    setValue,
    watch,
    isSubmitting,
}: AccountFormProps) {
    const selectedColor = watch('color');
    const colorPalette = ACCOUNT.COLOR_PALETTE;
    const showColorPicker = false; // Controlled by Popover internal state usually, but here we might need local state if we want to control it. 
    // Actually, the original code used local state for the popover open state.

    // We need local state for the color picker popover if we want to match the original behavior exactly
    // But since we are extracting this, let's see if we can simplify or if we need to pass it in.
    // The original code had `const [showColorPicker, setShowColorPicker] = useState(false);`
    // I will add it here.

    return (
        <div className="space-y-4">
            {/* Account Name */}
            <div className="space-y-2">
                <Label htmlFor="name">{ACCOUNTS.LABELS.ACCOUNT_NAME}</Label>
                <Input
                    id="name"
                    type="text"
                    placeholder={ACCOUNTS.LABELS.ACCOUNT_NAME_PLACEHOLDER}
                    {...register('name')}
                    disabled={isSubmitting}
                />
                {errors.name && (
                    <p className="text-sm text-red-600">{errors.name.message as string}</p>
                )}
            </div>

            {/* Account Color */}
            <div className="space-y-2">
                <Label>{ACCOUNTS.LABELS.ACCOUNT_COLOR}</Label>
                <div className="flex flex-wrap gap-2 items-center">
                    {/* No Color Option */}
                    <button
                        type="button"
                        onClick={() => setValue('color', ACCOUNT.NO_COLOR, { shouldDirty: true })}
                        disabled={isSubmitting}
                        className={cn(
                            'w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all',
                            selectedColor === ACCOUNT.NO_COLOR
                                ? 'border-zinc-900 dark:border-zinc-100 ring-2 ring-offset-2 ring-zinc-900 dark:ring-zinc-100'
                                : 'border-zinc-300 dark:border-zinc-700'
                        )}
                    >
                        <X className="w-4 h-4 text-zinc-400" />
                    </button>

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
                            aria-label={`Select color ${color}`}
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
                                <Label htmlFor="custom-color" className="text-sm">{ACCOUNTS.LABELS.CUSTOM_COLOR}</Label>
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
                                        maxLength={7}
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
