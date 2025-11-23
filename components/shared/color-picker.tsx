'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCOUNT } from '@/lib/constants';

interface ColorPickerProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    allowNoColor?: boolean;
}

export function ColorPicker({
    value,
    onChange,
    disabled,
    allowNoColor = false,
}: ColorPickerProps) {
    const colorPalette = ACCOUNT.COLOR_PALETTE;

    return (
        <div className="flex flex-wrap gap-2 items-center">
            {/* No Color Option */}
            {allowNoColor && (
                <button
                    type="button"
                    onClick={() => onChange(ACCOUNT.NO_COLOR)}
                    disabled={disabled}
                    className={cn(
                        'w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all',
                        value === ACCOUNT.NO_COLOR
                            ? 'border-zinc-900 dark:border-zinc-100 ring-2 ring-offset-2 ring-zinc-900 dark:ring-zinc-100'
                            : 'border-zinc-300 dark:border-zinc-700'
                    )}
                    aria-label="Select no color"
                >
                    <X className="w-4 h-4 text-zinc-400" />
                </button>
            )}

            {/* Color Palette */}
            {colorPalette.map((color) => (
                <button
                    key={color}
                    type="button"
                    onClick={() => onChange(color)}
                    disabled={disabled}
                    style={{ backgroundColor: color }}
                    className={cn(
                        'w-8 h-8 rounded-full border-2 transition-all',
                        value === color
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
                        disabled={disabled}
                        className="w-8 h-8 rounded-full border-2 border-zinc-300 dark:border-zinc-700 flex items-center justify-center bg-gradient-to-br from-red-500 via-green-500 to-blue-500 hover:border-zinc-900 dark:hover:border-zinc-100 transition-all"
                    >
                        <Plus className="w-4 h-4 text-white drop-shadow-md" />
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3" align="start">
                    <div className="space-y-2">
                        <Label htmlFor="custom-color" className="text-sm">Custom Color</Label>
                        <div className="flex gap-2 items-center">
                            <Input
                                id="custom-color"
                                type="color"
                                value={value}
                                onChange={(e) => onChange(e.target.value)}
                                disabled={disabled}
                                className="w-16 h-10 cursor-pointer"
                            />
                            <Input
                                type="text"
                                value={value}
                                onChange={(e) => onChange(e.target.value)}
                                disabled={disabled}
                                placeholder={ACCOUNT.DEFAULT_COLOR}
                                className="flex-1 font-mono text-xs"
                                maxLength={7}
                            />
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
