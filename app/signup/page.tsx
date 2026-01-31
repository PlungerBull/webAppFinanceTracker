'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { getAuthApi } from '@/lib/auth/client';
import { signUpSchema, type SignUpFormData } from '@/features/auth/schemas/auth.schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { AUTH } from '@/lib/constants';

export default function SignUpPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
  });

  const onSubmit = async (data: SignUpFormData) => {
    setError(null);

    const credential = getAuthApi().credential;
    if (!credential) {
      setError('Credential authentication is not available');
      return;
    }

    const result = await credential.signUp({
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
    });

    if (!result.success) {
      setError(result.error.message);
      return;
    }

    setSuccess(true);

    // Redirect to login after 2 seconds
    setTimeout(() => {
      router.push(`/login?message=${AUTH.SIGNUP.MESSAGES.SUCCESS_REDIRECT}`);
    }, 2000);
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-zinc-900 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">{AUTH.SIGNUP.CHECK_EMAIL_TITLE}</CardTitle>
            <CardDescription>
              {AUTH.SIGNUP.CHECK_EMAIL_DESC}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{AUTH.SIGNUP.TITLE}</CardTitle>
          <CardDescription>
            {AUTH.SIGNUP.DESCRIPTION}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-white border border-red-200 dark:bg-red-900/20 rounded-md">
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">{AUTH.SIGNUP.LABELS.FIRST_NAME}</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder={AUTH.SIGNUP.PLACEHOLDERS.FIRST_NAME}
                  {...register('firstName')}
                  disabled={isSubmitting}
                />
                {errors.firstName && (
                  <p className="text-sm text-red-600">
                    {errors.firstName.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">{AUTH.SIGNUP.LABELS.LAST_NAME}</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder={AUTH.SIGNUP.PLACEHOLDERS.LAST_NAME}
                  {...register('lastName')}
                  disabled={isSubmitting}
                />
                {errors.lastName && (
                  <p className="text-sm text-red-600">
                    {errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{AUTH.SIGNUP.LABELS.EMAIL}</Label>
              <Input
                id="email"
                type="email"
                placeholder={AUTH.SIGNUP.PLACEHOLDERS.EMAIL}
                {...register('email')}
                disabled={isSubmitting}
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{AUTH.SIGNUP.LABELS.PASSWORD}</Label>
              <Input
                id="password"
                type="password"
                placeholder={AUTH.SIGNUP.PLACEHOLDERS.PASSWORD}
                {...register('password')}
                disabled={isSubmitting}
              />
              {errors.password && (
                <p className="text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{AUTH.SIGNUP.LABELS.CONFIRM_PASSWORD}</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder={AUTH.SIGNUP.PLACEHOLDERS.PASSWORD}
                {...register('confirmPassword')}
                disabled={isSubmitting}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-red-600">{errors.confirmPassword.message}</p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {AUTH.SIGNUP.BUTTONS.CREATING_ACCOUNT}
                </>
              ) : (
                AUTH.SIGNUP.BUTTONS.SIGN_UP
              )}
            </Button>

            <p className="text-sm text-center text-zinc-600 dark:text-zinc-400">
              {AUTH.SIGNUP.LABELS.ALREADY_HAVE_ACCOUNT}{' '}
              <Link href="/login" className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline">
                {AUTH.SIGNUP.LABELS.LOGIN}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
