'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAddCategory } from '../hooks/use-categories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Archive,
    X,
    Check,
    Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCOUNT, VALIDATION, ACCOUNTS } from '@/lib/constants';
import * as DialogPrimitive from '@radix-ui/react-dialog';

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
    const [categoryType, setCategoryType] = useState<'income' | 'expense'>('expense');

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors, isSubmitting }
    } = useForm<CategoryFormData>({
        resolver: zodResolver(categorySchema),
        defaultValues: {
            name: '',
            color: ACCOUNT.DEFAULT_COLOR,
        }
    });

    const selectedColor = watch('color');

    const handleClose = () => {
        reset();
        setCategoryType('expense'); // Reset to default
        onOpenChange(false);
    };

    const onSubmit = async (data: CategoryFormData) => {
        try {
            await addCategoryMutation.mutateAsync({
                name: data.name,
                color: data.color,
                parent_id: null, // Always null for top-level groupings
                type: categoryType, // Include type in submission
            });
            handleClose();
        } catch (error) {
            console.error('Failed to create grouping:', error);
        }
    };

    // Color Palette
    const colorPalette = [
        '#F97316', // Orange (Active default in design)
        '#3B82F6', // Blue
        '#10B981', // Emerald
        '#EAB308', // Yellow
        '#8B5CF6', // Violet
        '#EC4899', // Pink
        '#EF4444', // Red
        '#6B7280', // Gray
        '#14B8A6', // Teal
        '#F43F5E', // Rose
    ];

    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <DialogPrimitive.Portal>
                {/* Backdrop */}
                <DialogPrimitive.Overlay className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 animate-in fade-in duration-200" />

                {/* Modal Container */}
                <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-sm translate-x-[-50%] translate-y-[-50%] outline-none animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl overflow-visible flex flex-col max-h-[90vh]">

                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="bg-gray-50 p-2 rounded-full">
                                    <Archive className="w-[18px] h-[18px] text-gray-400" />
                                </div>
                                <DialogPrimitive.Title asChild>
                                    <h2 className="text-sm font-bold text-gray-900">New Grouping</h2>
                                </DialogPrimitive.Title>
                            </div>
                            <button
                                onClick={handleClose}
                                className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body (Scrollable) */}
                        <div className="p-6 space-y-6 overflow-y-auto">
                            {/* Name Input */}
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-gray-500 uppercase">GROUP NAME</Label>
                                <Input
                                    {...register('name')}
                                    autoComplete="off"
                                    className="text-lg text-gray-800 bg-gray-50 border-transparent focus:bg-white focus:border-gray-200 rounded-xl px-4 py-6 shadow-none transition-all placeholder:text-gray-300"
                                    placeholder="e.g. Lifestyle, Fixed Costs"
                                />
                                {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                            </div>

                            {/* Color Picker */}
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-gray-500 uppercase">COLOR THEME</Label>
                                <div className="grid grid-cols-5 gap-3">
                                    {colorPalette.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setValue('color', color, { shouldDirty: true })}
                                            className={cn(
                                                "w-10 h-10 rounded-full transition-all flex items-center justify-center hover:scale-110",
                                                selectedColor === color
                                                    ? "scale-110 ring-2 ring-offset-2 ring-gray-300 shadow-md"
                                                    : ""
                                            )}
                                            style={{ backgroundColor: color }}
                                        >
                                            {selectedColor === color && (
                                                <Check className="w-5 h-5 text-white drop-shadow-md" strokeWidth={3} />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Category Type */}
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-gray-500 uppercase">CATEGORY TYPE</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setCategoryType('expense')}
                                        className={cn(
                                            "py-3 px-4 rounded-xl text-sm font-medium transition-all",
                                            categoryType === 'expense'
                                                ? "bg-red-50 text-red-700 ring-2 ring-red-200"
                                                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                                        )}
                                    >
                                        Expense
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCategoryType('income')}
                                        className={cn(
                                            "py-3 px-4 rounded-xl text-sm font-medium transition-all",
                                            categoryType === 'income'
                                                ? "bg-green-50 text-green-700 ring-2 ring-green-200"
                                                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                                        )}
                                    >
                                        Income
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-100 shrink-0">
                            <Button
                                onClick={handleSubmit(onSubmit)}
                                disabled={isSubmitting}
                                className="w-full bg-gray-900 hover:bg-black text-white font-bold py-6 rounded-xl shadow-lg shadow-gray-200 hover:shadow-xl transition-all active:scale-[0.99]"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    'Create Group'
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
