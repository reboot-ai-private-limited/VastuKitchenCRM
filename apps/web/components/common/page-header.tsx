import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0 space-y-0.5">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Standard page rhythm: padding is the shell's; blocks are spaced 20px apart. */
export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('space-y-5', className)}>{children}</div>;
}
