'use client';

import { Button } from '@/components/ui/button';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="max-w-sm space-y-3 text-center" role="alert">
        <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="text-muted-foreground">It is not your fault. Please try again.</p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
