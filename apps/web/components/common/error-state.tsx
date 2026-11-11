import { RotateCw, TriangleAlert } from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Inline "couldn't load this" with a retry. Never a blank screen. */
export function ErrorState({
  error,
  onRetry,
  title = 'Couldn’t load this',
  className,
}: {
  error?: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
}) {
  const message =
    error instanceof ApiError
      ? error.status === 0
        ? 'Connection lost. Check your internet and try again.'
        : error.message
      : 'Something went wrong. Please try again.';
  return (
    <div role="alert" className={cn('flex flex-wrap items-center gap-3 p-4', className)}>
      <TriangleAlert className="text-danger size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground text-xs">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw /> Retry
        </Button>
      )}
    </div>
  );
}
