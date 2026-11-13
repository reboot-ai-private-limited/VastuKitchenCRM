import type { LeadStatus } from '@vastu/contracts';
import { atLocalTime, todayIn } from '@/shared/time/businessDate.js';
import type { BusinessClock } from '@/shared/time/businessClock.js';
import type { StaffMember } from '@/modules/identity/identity.public.js';
import type { DashboardSources } from '../usecases/getDashboard.usecase.js';
import { GetDashboardUseCase } from '../usecases/getDashboard.usecase.js';

export const TZ = 'Asia/Kolkata';
export const DAY = 86_400_000;

const ZERO_STATUS: Record<LeadStatus, number> = {
  NEW: 0,
  CONTACTED: 0,
  VISIT: 0,
  PROPOSAL_SENT: 0,
  FOLLOW_UP: 0,
  WON: 0,
  LOST: 0,
};

export const staff = (
  over: Partial<StaffMember> & Pick<StaffMember, 'id' | 'name'>,
): StaffMember => ({
  role: 'SALES',
  designation: 'Executive',
  attendanceType: 'GPS',
  fixedSalary: 20_000,
  active: true,
  ...over,
});

/** Wednesday 11 November 2026, 15:30 in Siliguri. */
export const NOW = '2026-11-11T10:00:00Z';

/** Fake sources: set the data, read back what the dashboard asked. */
export function world(nowIso = NOW) {
  const calls: Record<string, unknown[][]> = {};
  const seen = (name: string, ...args: unknown[]) => {
    (calls[name] ??= []).push(args);
  };
  const fail = new Set<string>();
  const guard = (name: string) => {
    if (fail.has(name)) throw new Error(`${name} is down`);
  };

  const data = {
    staff: [] as StaffMember[],
    leadByStatus: { ...ZERO_STATUS },
    leadsCreated: 0,
    leadActivity: [] as Array<{
      userId: string;
      actions: number;
      leadsHandled: number;
      firstAt: Date;
      lastAt: Date;
    }>,
    calls: [] as Array<{ userId: string; calls: number; answered: number; talkSeconds: number }>,
    openLeadIds: [] as string[],
    wonLeadIds: [] as string[],
    wonLeads: [] as Array<{ leadId: string; assignedToId: string | null }>,
    targets: [] as Array<{ userId: string; amount: number; carriedFrom: string | null }>,
    leadStates: [] as Array<{
      id: string;
      name: string;
      status: LeadStatus;
      statusChangedAt: Date;
      assignedToId: string | null;
    }>,
    stuck: [] as Array<{
      id: string;
      name: string;
      status: LeadStatus;
      statusChangedAt: Date;
      assignedToId: string | null;
    }>,
    proposalActivity: [] as Array<{
      userId: string;
      generated: number;
      sent: number;
      firstAt: Date;
      lastAt: Date;
    }>,
    totals: [] as Array<{ leadId: string; total: number }>,
    unseen: [] as Array<{
      id: string;
      number: string;
      leadId: string;
      customerName: string;
      sentById: string | null;
      sentAt: Date;
      firstSeenAt: Date | null;
    }>,
    seenProposals: [] as Array<{
      id: string;
      number: string;
      leadId: string;
      customerName: string;
      sentById: string | null;
      sentAt: Date;
      firstSeenAt: Date | null;
    }>,
    stages: { DESIGN: 0, SITE: 0, CLOSED: 0 },
    feedActivity: [] as Array<{
      userId: string;
      posts: number;
      comments: number;
      firstAt: Date;
      lastAt: Date;
    }>,
    customerFeed: [] as Array<{
      kind: 'POST' | 'COMMENT' | 'APPROVAL';
      at: Date;
      projectId: string;
      postId: string;
      authorId: string;
      snippet: string | null;
      hasPhotos: boolean;
    }>,
    projectNames: new Map<string, string>(),
    users: new Map<string, string>(),
    complaintCounts: { OPEN: 0, ASSIGNED: 0, RESOLVED: 0, CLOSED: 0 },
    staleComplaints: [] as Array<{
      id: string;
      projectId: string;
      projectName: string;
      description: string;
      assignedToId: string | null;
      reopenCount: number;
      activeSince: Date;
    }>,
    overdueTodos: [] as Array<{
      id: string;
      title: string;
      projectId: string;
      projectName: string;
      dueOn: string;
      assigneeIds: string[];
      createdById: string;
    }>,
    dayCounts: { date: '2026-11-11', offDay: false, tracked: 0, present: 0, absent: 0 },
    attendance: [] as Array<{
      userId: string;
      daysPresent: number;
      inAt: Date | null;
      outAt: Date | null;
    }>,
    thresholds: { unseenDays: 2, noActionDays: 2, stuckDays: 2, complaintDays: 3 },
  };

  const sources: DashboardSources = {
    leads: {
      async dashboardCounts(from, to) {
        guard('leads');
        seen('dashboardCounts', from, to);
        return { byStatus: data.leadByStatus, createdInRange: data.leadsCreated };
      },
      async activitySummary(from, to) {
        guard('leads');
        seen('leadActivity', from, to);
        return data.leadActivity;
      },
      async callStats(from, to) {
        seen('callStats', from, to);
        return data.calls;
      },
      async openLeadIds(limit) {
        seen('openLeadIds', limit);
        return data.openLeadIds.slice(0, limit);
      },
      async wonLeadIds(from, to, limit) {
        seen('wonLeadIds', from, to, limit);
        return data.wonLeadIds.slice(0, limit);
      },
      async wonLeads(from, to, limit) {
        seen('wonLeads', from, to, limit);
        return data.wonLeads.slice(0, limit);
      },
      async getLeadStates(ids) {
        return data.leadStates.filter((l) => ids.includes(l.id));
      },
      async findStuckLeads(q) {
        seen('findStuck', q);
        return data.stuck.slice(0, q.limit);
      },
    },
    proposals: {
      async activitySummary() {
        return data.proposalActivity;
      },
      async latestSentTotals(ids) {
        return data.totals.filter((t) => ids.includes(t.leadId));
      },
      async findUnseenSent(w) {
        seen('findUnseen', w);
        return data.unseen.slice(0, w.limit);
      },
      async findSeen(w) {
        seen('findSeen', w);
        return data.seenProposals.slice(0, w.limit);
      },
    },
    projects: {
      async countByStage() {
        guard('projects');
        return data.stages;
      },
      async feedActivitySummary() {
        return data.feedActivity;
      },
      async recentCustomerActivity(limit) {
        guard('feed');
        return data.customerFeed.slice(0, limit);
      },
      async getProjectNames(ids) {
        return ids.flatMap((id) =>
          data.projectNames.has(id) ? [{ id, name: data.projectNames.get(id)! }] : [],
        );
      },
    },
    complaints: {
      async countByStatus() {
        return data.complaintCounts;
      },
      async findStale(w) {
        seen('findStale', w);
        return data.staleComplaints.slice(0, w.limit);
      },
    },
    todos: {
      async findOverdue(w) {
        return data.overdueTodos.slice(0, w.limit);
      },
    },
    hr: {
      async dayCounts(date) {
        seen('dayCounts', date);
        return { ...data.dayCounts, date };
      },
      async attendanceSummary(from, to) {
        seen('attendance', from, to);
        return data.attendance;
      },
      async targetsForMonth(month) {
        seen('targets', month);
        guard('targets');
        return data.targets;
      },
    },
    directory: {
      async getStaff() {
        return data.staff;
      },
      async getUserSummaries(ids) {
        return ids.flatMap((id) =>
          data.users.has(id)
            ? [
                {
                  id,
                  name: data.users.get(id)!,
                  phone: '9000000000',
                  role: 'CUSTOMER' as const,
                  designation: null,
                  active: true,
                },
              ]
            : [],
        );
      },
    },
    thresholds: { load: async () => data.thresholds },
  };

  let now = new Date(nowIso);
  const clock: BusinessClock = {
    now: () => now,
    dateOf: (i) => todayIn(TZ, i),
    at: (date, hhmm) => atLocalTime(TZ, date, hhmm),
  };
  return {
    data,
    calls,
    fail: (name: string) => fail.add(name),
    set: (iso: string) => (now = new Date(iso)),
    run: new GetDashboardUseCase(sources, clock),
  };
}

export const ADMIN = { role: 'ADMIN' };
export const HR = { role: 'HR' };
export const at = (iso: string) => new Date(iso);
