'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { AuthUserEntity } from '@/domain/auth';
import {
    updateProfileSchema,
    type UpdateProfileFormData,
} from '@/lib/schemas/profile.schema';
import { getAuthApi } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { SETTINGS } from '@/lib/constants';
import { getInitials } from '@/lib/utils';

interface ProfileSettingsProps {
    user: AuthUserEntity | null;
    initialize: () => void;
    openPasswordModal: () => void;
    openEmailModal: () => void;
}

export function ProfileSettings({ user, initialize, openPasswordModal, openEmailModal }: ProfileSettingsProps) {
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting, isDirty },
        reset,
    } = useForm<UpdateProfileFormData>({
        resolver: zodResolver(updateProfileSchema),
        defaultValues: {
            firstName: user?.firstName || '',
            lastName: user?.lastName || '',
        },
    });

    useEffect(() => {
        if (user) {
            reset({
                firstName: user.firstName || '',
                lastName: user.lastName || '',
            });
        }
    }, [user, reset]);

    const onSubmit = async (data: UpdateProfileFormData) => {
        try {
            setError(null);
            setSuccess(false);
            await getAuthApi().updateUserMetadata(data);
            setSuccess(true);
            initialize();
            reset(data);
            setTimeout(() => setSuccess(false), SETTINGS.TIMEOUTS.SUCCESS_MESSAGE);
        } catch (err) {
            setError(err instanceof Error ? err.message : SETTINGS.MESSAGES.ERROR.UPDATE_FAILED);
        }
    };

    const initials = getInitials(
        user?.firstName ?? undefined,
        user?.lastName ?? undefined
    );

    return (
        <div className="space-y-8">
            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-6">
                <h3 className="text-xl font-semibold mb-1">{SETTINGS.HEADERS.ACCOUNT}</h3>
                <p className="text-sm text-muted-foreground">
                    {SETTINGS.DESCRIPTIONS.ACCOUNT}
                </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                {error && (
                    <div className="p-3 text-sm text-red-600 bg-white border border-red-200 dark:bg-red-900/20 rounded-md">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="p-3 text-sm text-green-700 bg-white border border-green-200 dark:bg-green-900/20 rounded-md">
                        {SETTINGS.MESSAGES.SUCCESS.PROFILE_UPDATED}
                    </div>
                )}

                {/* Photo Section */}
                <div className="space-y-4">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{SETTINGS.HEADERS.PHOTO}</h4>
                    <div className="flex items-center gap-6">
                        <div className="flex-shrink-0 h-20 w-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-3xl font-medium ring-4 ring-zinc-50 dark:ring-zinc-900">
                            {initials || '?'}
                        </div>
                        <Button type="button" variant="outline" size="sm" disabled>
                            {SETTINGS.BUTTONS.UPLOAD_PHOTO}
                        </Button>
                    </div>
                </div>

                {/* Name Section */}
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="firstName">{SETTINGS.LABELS.FIRST_NAME}</Label>
                            <Input id="firstName" {...register('firstName')} />
                            {errors.firstName && (
                                <p className="text-sm text-red-600">{errors.firstName.message}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="lastName">{SETTINGS.LABELS.LAST_NAME}</Label>
                            <Input id="lastName" {...register('lastName')} />
                            {errors.lastName && (
                                <p className="text-sm text-red-600">{errors.lastName.message}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Security Section */}
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                            <div className="space-y-0.5 overflow-hidden">
                                <Label className="text-base">{SETTINGS.LABELS.EMAIL}</Label>
                                <p className="text-sm text-muted-foreground truncate" title={user?.email ?? undefined}>{user?.email}</p>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={openEmailModal}
                                className="flex-shrink-0 ml-2"
                            >
                                {SETTINGS.BUTTONS.CHANGE}
                            </Button>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                            <div className="space-y-0.5">
                                <Label className="text-base">{SETTINGS.LABELS.PASSWORD}</Label>
                                <p className="text-sm text-muted-foreground">{SETTINGS.LABELS.PASSWORD_PLACEHOLDER}</p>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={openPasswordModal}
                            >
                                {SETTINGS.BUTTONS.CHANGE}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="pt-4 flex justify-end">
                    <Button type="submit" disabled={isSubmitting || !isDirty}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {SETTINGS.BUTTONS.UPDATE_PROFILE}
                    </Button>
                </div>
            </form>
        </div>
    );
}
