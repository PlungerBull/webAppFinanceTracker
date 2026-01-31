'use client';

import { changeEmailSchema, type ChangeEmailFormData } from '@/features/auth/schemas/profile.schema';
import { getAuthApi } from '@/lib/auth/client';
import { FormModal } from '@/components/ui/form-modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UI } from '@/lib/constants';

interface ChangeEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangeEmailModal({ open, onOpenChange }: ChangeEmailModalProps) {
  const handleSubmit = async (data: ChangeEmailFormData) => {
    const credential = getAuthApi().credential;
    if (!credential) {
      throw new Error('Credential authentication is not available');
    }

    const result = await credential.changeEmail({
      newEmail: data.newEmail,
    });

    if (!result.success) {
      throw new Error(result.error.message);
    }
  };

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={UI.MODALS.CHANGE_EMAIL.TITLE}
      description={UI.MODALS.CHANGE_EMAIL.DESCRIPTION}
      successMessage={UI.MODALS.CHANGE_EMAIL.SUCCESS}
      schema={changeEmailSchema}
      onSubmit={handleSubmit}
      autoCloseDelay={UI.AUTO_CLOSE_DELAY.LONG}
    >
      {({ register, formState: { errors, isSubmitting } }) => (
        <>
          <div className="space-y-2">
            <Label htmlFor="newEmail">{UI.MODALS.CHANGE_EMAIL.LABELS.NEW_EMAIL}</Label>
            <Input
              id="newEmail"
              type="email"
              {...register('newEmail')}
              disabled={isSubmitting}
            />
            {errors.newEmail && (
              <p className="text-sm text-red-600">
                {errors.newEmail.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="currentPassword-email">{UI.MODALS.CHANGE_EMAIL.LABELS.CURRENT_PASSWORD}</Label>
            <Input
              id="currentPassword-email"
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
        </>
      )}
    </FormModal>
  );
}