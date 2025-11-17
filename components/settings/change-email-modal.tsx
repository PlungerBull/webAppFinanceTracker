'use client';

import {
  changeEmailSchema,
  type ChangeEmailFormData,
} from '@/features/auth/schemas/profile.schema';
import { authApi } from '@/features/auth/api/auth';
import { FormModal } from '@/components/ui/form-modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UI } from '@/lib/constants';

interface ChangeEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangeEmailModal({ open, onOpenChange }: ChangeEmailModalProps) {
  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Change Email"
      description="Enter your new email and current password. A confirmation will be sent to both your old and new email addresses."
      successMessage="Success! Please check your email to confirm the change."
      schema={changeEmailSchema}
      onSubmit={authApi.changeEmail}
      autoCloseDelay={UI.AUTO_CLOSE_DELAY.LONG}
    >
      {({ register, formState: { errors, isSubmitting } }) => (
        <>
          <div className="space-y-2">
            <Label htmlFor="newEmail">New Email</Label>
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
            <Label htmlFor="currentPassword-email">Current Password</Label>
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