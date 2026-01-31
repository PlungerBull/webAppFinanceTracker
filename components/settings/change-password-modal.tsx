'use client';

import { changePasswordSchema, type ChangePasswordFormData } from '@/features/auth/schemas/profile.schema';
import { getAuthApi } from '@/lib/auth';
import { FormModal } from '@/components/ui/form-modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UI } from '@/lib/constants';

interface ChangePasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordModal({
  open,
  onOpenChange,
}: ChangePasswordModalProps) {
  const handleSubmit = async (data: ChangePasswordFormData) => {
    const credential = getAuthApi().credential;
    if (!credential) {
      throw new Error('Credential authentication is not available');
    }

    const result = await credential.changePassword({
      newPassword: data.newPassword,
    });

    if (!result.success) {
      throw new Error(result.error.message);
    }
  };

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={UI.MODALS.CHANGE_PASSWORD.TITLE}
      successMessage={UI.MODALS.CHANGE_PASSWORD.SUCCESS}
      schema={changePasswordSchema}
      onSubmit={handleSubmit}
      autoCloseDelay={UI.AUTO_CLOSE_DELAY.MEDIUM}
    >
      {({ register, formState: { errors, isSubmitting } }) => (
        <>
          <div className="space-y-2">
            <Label htmlFor="currentPassword">{UI.MODALS.CHANGE_PASSWORD.LABELS.CURRENT_PASSWORD}</Label>
            <Input
              id="currentPassword"
              type="password"
              {...register('currentPassword')}
              disabled={isSubmitting}
            />
            {errors.currentPassword && (
              <p className="text-sm text-red-600">
                {errors.currentPassword.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">{UI.MODALS.CHANGE_PASSWORD.LABELS.NEW_PASSWORD}</Label>
            <Input
              id="newPassword"
              type="password"
              {...register('newPassword')}
              disabled={isSubmitting}
            />
            {errors.newPassword && (
              <p className="text-sm text-red-600">
                {errors.newPassword.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{UI.MODALS.CHANGE_PASSWORD.LABELS.CONFIRM_PASSWORD}</Label>
            <Input
              id="confirmPassword"
              type="password"
              {...register('confirmPassword')}
              disabled={isSubmitting}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-red-600">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
        </>
      )}
    </FormModal>
  );
}