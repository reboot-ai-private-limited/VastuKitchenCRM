import { cn } from '@/lib/utils';

/** The "V" chip and wordmark. Replace with the real vector logo when the client sends it. */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 font-semibold tracking-tight', className)}>
      <span
        aria-hidden
        className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-lg text-base"
      >
        V
      </span>
      {!compact && <span className="text-base">Vaastu Kitchen</span>}
    </span>
  );
}
