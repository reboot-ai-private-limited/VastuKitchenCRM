import type { DashboardCountersDto, DashboardDto } from '@vastu/contracts';
import { StatCard } from '@/components/common/stat-card';
import { formatINR, formatINRShort } from '@/lib/format';

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

export function Counters({ counters, staff }: { counters: DashboardCountersDto; staff: Staff | null }) {
  const c = counters;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Open leads" value={c.leads.open} sub={`${c.leads.newInRange} new in this period`} href="/leads" />
        <StatCard
          label="Running projects"
          value={c.projects.running}
          sub={`Design ${c.projects.design} · Site ${c.projects.site}`}
          href="/projects"
        />
        <StatCard
          label="Complaints pending"
          value={c.complaints.pending}
          sub={`Open ${c.complaints.OPEN} · Assigned ${c.complaints.ASSIGNED} · To close ${c.complaints.RESOLVED}`}
          href="/complaints"
        />
        <StaffCard staff={staff} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          label="Pipeline"
          value={formatINRShort(c.value.pipeline)}
          title={formatINR(c.value.pipeline)}
          sub={c.value.pipelineCapped ? 'Open leads (first 2,000)' : 'Open leads, latest sent proposal'}
        />
        <StatCard label="Won in this period" value={formatINRShort(c.value.wonInRange)} title={formatINR(c.value.wonInRange)} sub="By latest sent proposal" />
        <StatCard label="New leads in this period" value={c.leads.newInRange} href="/leads" className="col-span-2 sm:col-span-1" />
      </div>
    </>
  );
}

export function CountersSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <StatCard key={i} label="" value="" loading />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <StatCard key={i} label="" value="" loading />
        ))}
      </div>
    </>
  );
}
