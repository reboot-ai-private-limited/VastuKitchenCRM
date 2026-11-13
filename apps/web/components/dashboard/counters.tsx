import type { DashboardCountersDto, DashboardDto } from '@vastu/contracts';
import { StatCard } from '@/components/common/stat-card';
import { DUMMY_MEETINGS_TODAY } from '@/lib/dashboard-dummy';

type Staff = NonNullable<DashboardDto['staff']>;

/** "Staff present today" is for Admin and HR; the rest is Admin only. */
export function StaffCard({ staff, loading }: { staff: Staff | null; loading?: boolean }) {
  return (
    <StatCard
      label="Staff present today"
      loading={loading}
      value={staff ? `${staff.present} / ${staff.tracked}` : '—'}
      sub={staff ? (staff.offDay ? 'Weekly off today' : `${staff.absent} absent`) : undefined}
      href="/attendance"
    />
  );
}

export function Counters({
  counters,
  staff,
}: {
  counters: DashboardCountersDto;
  staff: Staff | null;
}) {
  const c = counters;
  const upcoming = DUMMY_MEETINGS_TODAY.total - DUMMY_MEETINGS_TODAY.done;
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <StatCard label="New leads" value={c.leads.newInRange} sub="In this period" href="/leads" />
      {/* Placeholder until meetings are tracked. */}
      <StatCard
        label="Today’s meetings"
        value={DUMMY_MEETINGS_TODAY.total}
        sub={`${DUMMY_MEETINGS_TODAY.done} done · ${upcoming} upcoming`}
      />
      <StatCard
        label="Pending follow-ups"
        value={c.leads.byStatus.FOLLOW_UP ?? 0}
        sub="Leads in follow-up"
        href="/leads?status=FOLLOW_UP"
      />
      <StaffCard staff={staff} />
    </div>
  );
}

export function CountersSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <StatCard key={i} label="" value="" loading />
      ))}
    </div>
  );
}
