import Link from 'next/link';
import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  sub,
  href,
  title,
  loading,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  href?: string;
  /** Tooltip, e.g. the full rupee amount behind "₹90 L". */
  title?: string;
  loading?: boolean;
  className?: string;
}) {
  const body = (
    <>
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-20" />
      ) : (
        <p className="tabular mt-1 text-2xl font-semibold" title={title}>
          {value}
        </p>
      )}
      {loading ? <Skeleton className="mt-2 h-3.5 w-28" /> : sub && <p className="text-muted-foreground mt-0.5 text-xs">{sub}</p>}
    </>
  );
  const base = 'bg-card block rounded-lg border p-4';
  if (href && !loading) {
    return (
      <Link
        href={href}
        className={cn(base, 'hover:bg-primary-soft/40 focus-visible:ring-ring transition-colors focus-visible:ring-2 focus-visible:outline-none', className)}
      >
        {body}
      </Link>
    );
  }
  return <div className={cn(base, className)}>{body}</div>;
}
