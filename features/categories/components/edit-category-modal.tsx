'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUpdateCategory } from '../hooks/use-categories';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCOUNT, VALIDATION } from '@/lib/constants';
import type { Database } from '@/types/database.types';

// Use the view type which includes transaction_count
type Category = Database['public']['Views']['categories_with_counts']['Row'];

interface EditCategoryModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    category: Category | null;
}

// Schema for the form
const categorySchema = z.object({
    name: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, 'Category name is required'),
    color: z.string().regex(ACCOUNT.COLOR_REGEX, 'Invalid color format'),
});

type CategoryFormData = z.infer<typeof categorySchema>;

export function EditCategoryModal({ open, onOpenChange, category }: EditCategoryModalProps) {
    const [error, setError] = useState<string | null>(null);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const updateCategoryMutation = useUpdateCategory();

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset,
        setValue,
        watch,
    } = useForm<CategoryFormData>({
        resolver: zodResolver(categorySchema),
        defaultValues: {
            color: ACCOUNT.DEFAULT_COLOR,
        },
    });

    const selectedColor = watch('color');

    // Predefined color palette
    const colorPalette = ACCOUNT.COLOR_PALETTE;

    useEffect(() => {
        if (category) {
            reset({
                name: category.name,
                color: category.color,
            });
        }
    }, [category, reset]);

    const onSubmit = async (data: CategoryFormData) => {
        if (!category) return;

        try {
            setError(null);
            await updateCategoryMutation.mutateAsync({
                id: category.id,
                data: {
                    name: data.name,
                    color: data.color,
                },
            });
            handleClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update category');
        }
    };

    const handleClose = () => {
        reset();
        setError(null);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Category</DialogTitle>
                    <DialogDescription>
                        Update category details
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {error && (
                        <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md">
                            {error}
                        </div>
                    )}

                    {/* Category Name */}
                    <div className="space-y-2">
                        <Label htmlFor="edit-name">Category Name *</Label>
                        <Input
                            id="edit-name"
                            type="text"
                            placeholder="e.g., Groceries, Rent, Salary"
                            {...register('name')}
                            disabled={isSubmitting}
                        />
                        {errors.name && (
                            <p className="text-sm text-red-600">{errors.name.message}</p>
                        )}
                    </div>

                    {/* Category Color */}
                    <div className="space-y-2">
                        <Label>Color *</Label>
                        <div className="flex flex-wrap gap-2 items-center">
                            {/* Color Palette */}
                            {colorPalette.map((color) => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => setValue('color', color)}
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
                            <Popover open={showColorPicker} onOpenChange={setShowColorPicker}>
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
                                        <Label htmlFor="edit-custom-color" className="text-sm">Custom Color</Label>
                                        <div className="flex gap-2 items-center">
                                            <Input
                                                id="edit-custom-color"
                                                type="color"
                                                value={selectedColor}
                                                onChange={(e) => setValue('color', e.target.value)}
                                                disabled={isSubmitting}
                                                className="w-16 h-10 cursor-pointer"
                                            />
                                            <Input
                                                type="text"
                                                value={selectedColor}
                                                onChange={(e) => setValue('color', e.target.value)}
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
                            <p className="text-sm text-red-600">{errors.color.message}</p>
                        )}
                    </div>

                    {/* Form Actions */}
                    <div className="flex gap-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={isSubmitting}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting} className="flex-1">
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Updating...
                                </>
                            ) : (
                                'Update Category'
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
