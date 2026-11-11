'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, TriangleAlert } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { loginBodySchema, type LoginBodyDto } from '@vastu/contracts';
import { Logo } from '@/components/common/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth';
import { landingFor } from '@/lib/nav';

const REASONS: Record<string, string> = {
  expired: 'Please sign in again.',
  network: 'Connection problem. Please sign in again.',
  'signed-out': 'You were signed out on another tab.',
};

/** Only same-site paths: a `next` parameter must never send someone to another website. */
const safeNext = (next: string | null): string | null => (next && next.startsWith('/') && !next.startsWith('//') ? next : null);

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { status, user, login } = useAuth();
  const [show, setShow] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const reason = params.get('reason');

  const form = useForm<LoginBodyDto>({
    resolver: zodResolver(loginBodySchema),
    defaultValues: { phone: '', password: '' },
  });
  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = form;

  useEffect(() => {
    if (status === 'authenticated' && user) router.replace(safeNext(params.get('next')) ?? landingFor(user.role));
  }, [status, user, router, params]);

  useEffect(() => setFocus('phone'), [setFocus]);

  async function onSubmit(values: LoginBodyDto) {
    setBanner(null);
    try {
      const me = await login(values.phone, values.password);
      router.replace(safeNext(params.get('next')) ?? landingFor(me.role));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setBanner('Phone or password is incorrect.');
      else if (err instanceof ApiError && err.status === 429) setBanner(err.message);
      else if (err instanceof ApiError) setBanner(err.message);
      else setBanner('Something went wrong. Please try again.');
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Logo />
        </div>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="bg-card space-y-4 rounded-xl border p-6"
          aria-describedby={banner ? 'login-error' : undefined}
        >
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-muted-foreground">Use your phone number and password.</p>
          </div>

          {(banner || (reason && REASONS[reason])) && (
            <div
              id="login-error"
              role="alert"
              className={`flex items-start gap-2 rounded-lg border p-3 ${banner ? 'border-danger/30 bg-danger-soft text-danger' : 'border-warning/30 bg-warning-soft text-warning'}`}
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{banner ?? REASONS[reason ?? '']}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone number *</Label>
            <div className="relative">
              <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 grid place-items-center">+91</span>
              <Input
                id="phone"
                inputMode="numeric"
                autoComplete="username"
                maxLength={10}
                className="h-10 pl-11 tabular"
                aria-invalid={!!errors.phone}
                {...register('phone')}
              />
            </div>
            {errors.phone && <p className="text-danger text-xs">{errors.phone.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password *</Label>
            <div className="relative">
              <Input
                id="password"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                className="h-10 pr-11"
                aria-invalid={!!errors.password}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Hide password' : 'Show password'}
                className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 grid w-11 place-items-center"
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {errors.password && <p className="text-danger text-xs">{errors.password.message}</p>}
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Sign in
          </Button>
          <p className="text-muted-foreground text-center text-xs">
            Forgot your password? Ask the owner or HR to reset it.
          </p>
        </form>
      </div>
    </main>
  );
}
