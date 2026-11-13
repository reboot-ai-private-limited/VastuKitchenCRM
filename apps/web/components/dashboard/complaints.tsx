import { CheckCircle2, Clock } from 'lucide-react';
import Link from 'next/link';
import type { DashboardAttentionDto, DashboardCountersDto } from '@vastu/contracts';
import { relativeAge } from '@/lib/format';
import { refHref } from '@/lib/notifications';

const Stat = ({ label, value, href }: { label: string; value: number; href: string }) => (
  <Link
    href={href}
    className="hover:bg-primary-soft/50 focus-visible:ring-ring flex-1 px-4 py-3 text-center focus-visible:ring-2 focus-visible:outline-none"
  >
    <p className="tabular text-xl font-semibold">{value}</p>
    <p className="text-muted-foreground text-xs">{label}</p>
  </Link>
);

export function ComplaintsCard({
  counts,
  overdue,
}: {
  counts: DashboardCountersDto['complaints'];
  overdue: DashboardAttentionDto['overdueComplaints'];
}) {
  return (
    <div>
      <div className="grid grid-cols-3 divide-x border-b">
        <Stat label="Open" value={counts.OPEN} href="/complaints?status=OPEN" />
        <Stat label="Assigned" value={counts.ASSIGNED} href="/complaints?status=ASSIGNED" />
        <Stat label="To close" value={counts.RESOLVED} href="/complaints?status=RESOLVED" />
      </div>
      {overdue.total === 0 ? (
        <p className="text-muted-foreground flex items-center gap-1 px-4 py-4 text-sm">
          <CheckCircle2 className="text-success size-4" aria-hidden /> Nothing waiting too long
        </p>
      ) : (
        <ul className="py-2">
          {overdue.items.map((item, i) => (
            <li key={`${item.ref.id}-${i}`}>
              <Link
                href={refHref(item.ref)}
                className="hover:bg-primary-soft/50 focus-visible:ring-ring flex items-start gap-3 px-4 py-2 focus-visible:ring-2 focus-visible:outline-none"
              >
                <span aria-hidden className="bg-danger mt-1.5 size-2 shrink-0 rounded-full" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.title}</span>
                  <span className="text-muted-foreground block text-xs">{item.detail}</span>
                </span>
                <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-xs whitespace-nowrap">
                  <Clock className="size-3" aria-hidden />
                  {relativeAge(item.since)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
