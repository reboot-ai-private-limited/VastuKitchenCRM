'use client';

import { Eye, EyeOff, Loader2, TriangleAlert } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { otpRequestBodySchema, otpVerifyBodySchema } from '@vastu/contracts';
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

const RESEND_SECONDS = 30;

/** Only same-site paths: a `next` parameter must never send someone to another website. */
const safeNext = (next: string | null): string | null =>
  next && next.startsWith('/') && !next.startsWith('//') ? next : null;

type Mode = 'otp' | 'password';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { status, user, login, requestOtp, verifyOtp } = useAuth();
  const [mode, setMode] = useState<Mode>('otp');
  const [codeSent, setCodeSent] = useState(false);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const reason = params.get('reason');

  useEffect(() => {
    if (status === 'authenticated' && user)
      router.replace(safeNext(params.get('next')) ?? landingFor(user.role));
  }, [status, user, router, params]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  function fail(err: unknown, wrong: string) {
    if (err instanceof ApiError && (err.status === 401 || err.code === 'INVALID_OTP'))
      setBanner(wrong);
    else if (err instanceof ApiError) setBanner(err.message);
    else setBanner('Something went wrong. Please try again.');
  }

  function done(role: Parameters<typeof landingFor>[0]) {
    router.replace(safeNext(params.get('next')) ?? landingFor(role));
  }

  async function sendCode() {
    setBanner(null);
    const parsed = otpRequestBodySchema.safeParse({ phone });
    if (!parsed.success) return setFieldError('Enter your 10-digit mobile number');
    setFieldError(null);
    setBusy(true);
    try {
      await requestOtp(parsed.data.phone);
      setCodeSent(true);
      setCode('');
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      fail(err, 'Could not send the code.');
    } finally {
      setBusy(false);
    }
  }

  async function submitCode() {
    setBanner(null);
    const parsed = otpVerifyBodySchema.safeParse({ phone, code });
    if (!parsed.success) return setFieldError('Enter the 6-digit code');
    setFieldError(null);
    setBusy(true);
    try {
      done((await verifyOtp(parsed.data.phone, parsed.data.code)).role);
    } catch (err) {
      fail(err, 'That code is incorrect or has expired. Ask for a new one.');
      setBusy(false);
    }
  }

  async function submitPassword() {
    setBanner(null);
    const parsed = otpRequestBodySchema.safeParse({ phone });
    if (!parsed.success) return setFieldError('Enter your 10-digit mobile number');
    if (!password) return setFieldError('Enter your password');
    setFieldError(null);
    setBusy(true);
    try {
      done((await login(parsed.data.phone, password)).role);
    } catch (err) {
      fail(err, 'Phone or password is incorrect.');
      setBusy(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (mode === 'password') void submitPassword();
    else if (codeSent) void submitCode();
    else void sendCode();
  }

  function switchMode(next: Mode) {
    setMode(next);
    setBanner(null);
    setFieldError(null);
    setCodeSent(false);
    setCode('');
    setPassword('');
  }

  const onCodeStep = mode === 'otp' && codeSent;

  return (
    <main className="grid min-h-dvh place-items-center bg-[radial-gradient(60rem_30rem_at_50%_-10%,var(--primary-soft),transparent)] p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Logo />
        </div>
        <form
          onSubmit={onSubmit}
          noValidate
          className="bg-card shadow-card space-y-4 rounded-2xl border p-6"
          aria-describedby={banner ? 'login-error' : undefined}
        >
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-muted-foreground">
              {mode === 'password'
                ? 'Use your phone number and password.'
                : onCodeStep
                  ? `We sent a 6-digit code to +91 ${phone.replace(/\D/g, '').slice(-10)} on WhatsApp.`
                  : 'We’ll send a one-time code to your WhatsApp.'}
            </p>
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
              <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 grid place-items-center">
                +91
              </span>
              <Input
                id="phone"
                inputMode="numeric"
                autoComplete="username"
                autoFocus
                maxLength={10}
                value={phone}
                disabled={onCodeStep}
                onChange={(e) => setPhone(e.target.value)}
                className="h-10 pl-11 tabular"
                aria-invalid={!!fieldError && !onCodeStep}
              />
            </div>
          </div>

          {onCodeStep && (
            <div className="space-y-1.5">
              <Label htmlFor="code">6-digit code *</Label>
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="h-10 text-center text-lg tracking-[0.5em] tabular"
                aria-invalid={!!fieldError}
              />
            </div>
          )}

          {mode === 'password' && (
            <div className="space-y-1.5">
              <Label htmlFor="password">Password *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 pr-11"
                  aria-invalid={!!fieldError}
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
            </div>
          )}

          {fieldError && <p className="text-danger text-xs">{fieldError}</p>}

          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {mode === 'password' ? 'Sign in' : onCodeStep ? 'Verify and sign in' : 'Send code'}
          </Button>

          {onCodeStep && (
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => switchMode('otp')}
              >
                Change number
              </button>
              <button
                type="button"
                disabled={cooldown > 0 || busy}
                className="text-primary disabled:text-muted-foreground"
                onClick={() => void sendCode()}
              >
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </button>
            </div>
          )}

          <button
            type="button"
            className="text-muted-foreground hover:text-foreground block w-full text-center text-xs"
            onClick={() => switchMode(mode === 'otp' ? 'password' : 'otp')}
          >
            {mode === 'otp' ? 'Use password instead' : 'Use a WhatsApp code instead'}
          </button>
          {mode === 'password' && (
            <p className="text-muted-foreground text-center text-xs">
              Forgot your password? Ask the owner or HR to reset it, or sign in with a code.
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
