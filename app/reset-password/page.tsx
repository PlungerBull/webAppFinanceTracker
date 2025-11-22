'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { authApi } from '@/features/auth/api/auth';
import { resetPasswordSchema, type ResetPasswordFormData } from '@/features/auth/schemas/auth.schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft } from 'lucide-react';
import { AUTH } from '@/lib/constants';

export default function ResetPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    try {
      setError(null);
      await authApi.resetPassword(data);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : AUTH.RESET_PASSWORD.MESSAGES.ERROR);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">{AUTH.RESET_PASSWORD.CHECK_EMAIL_TITLE}</CardTitle>
            <CardDescription>
              {AUTH.RESET_PASSWORD.CHECK_EMAIL_DESC}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/login" className="w-full">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {AUTH.RESET_PASSWORD.BUTTONS.BACK_TO_LOGIN}
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{AUTH.RESET_PASSWORD.TITLE}</CardTitle>
          <CardDescription>
            {AUTH.RESET_PASSWORD.DESCRIPTION}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">{AUTH.RESET_PASSWORD.LABELS.EMAIL}</Label>
              <Input
                id="email"
                type="email"
                placeholder={AUTH.RESET_PASSWORD.PLACEHOLDERS.EMAIL}
                {...register('email')}
                disabled={isSubmitting}
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {AUTH.RESET_PASSWORD.BUTTONS.SENDING_LINK}
                </>
              ) : (
                AUTH.RESET_PASSWORD.BUTTONS.SEND_LINK
              )}
            </Button>

            <Link href="/login" className="w-full">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {AUTH.RESET_PASSWORD.BUTTONS.BACK_TO_LOGIN}
              </Button>
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
