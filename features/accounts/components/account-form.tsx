'use client';

import { UseFormRegister, FieldErrors, UseFormSetValue, Control, useWatch } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ACCOUNTS } from '@/lib/constants';
import { ColorPicker } from '@/components/shared/color-picker';

/**
 * Account Form Data Shape
 *
 * CTO Standard: Explicit types for form data - no `any` types.
 */
export interface AccountFormData {
  name: string;
  color: string;
}

/**
 * Account Form Props
 *
 * Uses typed react-hook-form utilities with AccountFormData.
 */
interface AccountFormProps {
  register: UseFormRegister<AccountFormData>;
  errors: FieldErrors<AccountFormData>;
  setValue: UseFormSetValue<AccountFormData>;
  control: Control<AccountFormData>;
  isSubmitting: boolean;
}

export function AccountForm({
  register,
  errors,
  setValue,
  control,
  isSubmitting,
}: AccountFormProps) {
  const selectedColor = useWatch({
    control,
    name: 'color',
    defaultValue: '#3b82f6',
  });

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
        {errors.name?.message && (
          <p className="text-sm text-red-600">{errors.name.message}</p>
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
        {errors.color?.message && (
          <p className="text-sm text-red-600">{errors.color.message}</p>
        )}
      </div>
    </div>
  );
}
