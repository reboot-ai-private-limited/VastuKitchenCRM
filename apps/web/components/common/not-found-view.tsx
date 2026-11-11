import { Compass } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

/** Also what a role sees for a page it may not use: the API hides what you cannot see. */
export function NotFoundView() {
  return (
    <div className="mx-auto grid max-w-sm place-items-center gap-3 py-24 text-center">
      <Compass className="text-muted-foreground size-6" aria-hidden />
      <h1 className="text-xl font-semibold tracking-tight">We could not find that</h1>
      <p className="text-muted-foreground">It may have moved, or you may not have access to it.</p>
      <Button asChild>
        <Link href="/">Go to your home page</Link>
      </Button>
    </div>
  );
}
