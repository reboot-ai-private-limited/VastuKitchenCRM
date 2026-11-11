'use client';

import { Loader2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Logo } from '@/components/common/logo';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth';
import { landingFor } from '@/lib/nav';

/** A customer opens their one-time link: sign them in and take them to their project. */
export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { redeemInvite, status } = useAuth();
  const [failed, setFailed] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // Strict mode runs effects twice in development; a one-time link must only be used once.
    if (started.current || status === 'loading') return;
    started.current = true;
    redeemInvite(token)
      .then((user) => router.replace(landingFor(user.role)))
      .catch((err: unknown) =>
        setFailed(err instanceof ApiError && err.status === 429 ? err.message : 'This link has expired or was already used.'),
      );
  }, [token, status, redeemInvite, router]);

  const phone = process.env.NEXT_PUBLIC_COMPANY_PHONE;
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="flex justify-center">
          <Logo />
        </div>
        {failed ? (
          <div className="bg-card space-y-2 rounded-xl border p-6" role="alert">
            <h1 className="text-xl font-semibold tracking-tight">We couldn’t open that link</h1>
            <p className="text-muted-foreground">{failed} Ask Vaastu Kitchen for a new one.</p>
            {phone && (
              <a className="text-primary font-medium underline-offset-4 hover:underline" href={`tel:${phone}`}>
                {phone}
              </a>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground inline-flex items-center gap-2" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Opening your project…
          </p>
        )}
      </div>
    </main>
  );
}
