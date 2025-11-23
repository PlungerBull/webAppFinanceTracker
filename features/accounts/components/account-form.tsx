'use client';

import { UseFormRegister, FieldErrors, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ACCOUNT, ACCOUNTS } from '@/lib/constants';
import { ColorPicker } from '@/components/shared/color-picker';

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
                <ColorPicker
                    value={selectedColor}
                    onChange={(color) => setValue('color', color, { shouldDirty: true })}
                    disabled={isSubmitting}
                    allowNoColor={true}
                />
                {errors.color && (
                    <p className="text-sm text-red-600">{errors.color.message as string}</p>
                )}
            </div>
        </div>
    );
}
