import type { DashboardPersonDto } from '@vastu/contracts';
import type { StaffMember } from '@/modules/identity/identity.public.js';
import type { HrUserAttendance } from '@/modules/hr/hr.public.js';
import type { LeadUserActivity } from '@/modules/leads/leads.public.js';
import type { ProjectUserFeedActivity } from '@/modules/projects/projects.public.js';

export interface PeopleTargets {
  /** `YYYY-MM` the targets and achievements are for. */
  month: string;
  targets: Array<{ userId: string; amount: number; carriedFrom: string | null }>;
  /** Rupees won so far this month, per person. */
  achieved: Map<string, number>;
}

export interface PeopleInputs {
  staff: StaffMember[];
  attendance: HrUserAttendance[];
  /** Null for HR, who sees attendance only. */
  activity: {
    leads: LeadUserActivity[];
    calls: Array<{ userId: string; calls: number; answered: number; talkSeconds: number }>;
    proposals: Array<{
      userId: string;
      generated: number;
      sent: number;
      firstAt: Date;
      lastAt: Date;
    }>;
    feed: ProjectUserFeedActivity[];
  } | null;
  /** Null for HR, and when the targets could not be loaded. */
  targets?: PeopleTargets | null;
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

/**
 * One row per person: everyone on attendance, plus anyone (even someone since deactivated) who did
 * something in the range. "First" and "last activity" are the earliest and latest moment across
 * leads, proposals and the project feed; attendance in/out is shown separately because arriving at
 * 9:05 and last touching a lead at 4:40 are different facts.
 */
export function buildPeople(input: PeopleInputs): DashboardPersonDto[] {
  const attendance = new Map(input.attendance.map((a) => [a.userId, a]));
  const byId = <T extends { userId: string }>(rows: T[]) => new Map(rows.map((r) => [r.userId, r]));
  const a = input.activity;
  const leads = byId(a?.leads ?? []);
  const calls = byId(a?.calls ?? []);
  const proposals = byId(a?.proposals ?? []);
  const feed = byId(a?.feed ?? []);
  const tg = input.targets ?? null;
  const targets = byId(tg?.targets ?? []);

  const did = (id: string) => leads.has(id) || calls.has(id) || proposals.has(id) || feed.has(id);

  return input.staff
    .filter((s) => (s.active && s.attendanceType !== null) || did(s.id))
    .map((s): DashboardPersonDto => {
      const att = attendance.get(s.id);
      let activity: DashboardPersonDto['activity'] = null;
      if (a) {
        const l = leads.get(s.id);
        const c = calls.get(s.id);
        const p = proposals.get(s.id);
        const f = feed.get(s.id);
        const moments = [
          l?.firstAt,
          l?.lastAt,
          p?.firstAt,
          p?.lastAt,
          f?.firstAt,
          f?.lastAt,
        ].filter((d): d is Date => !!d);
        activity = {
          firstAt: iso(
            moments.length ? new Date(Math.min(...moments.map((m) => m.getTime()))) : null,
          ),
          lastAt: iso(
            moments.length ? new Date(Math.max(...moments.map((m) => m.getTime()))) : null,
          ),
          calls: c?.calls ?? 0,
          answeredCalls: c?.answered ?? 0,
          talkSeconds: c?.talkSeconds ?? 0,
          leadsHandled: l?.leadsHandled ?? 0,
          proposalsGenerated: p?.generated ?? 0,
          proposalsSent: p?.sent ?? 0,
          posts: f?.posts ?? 0,
          comments: f?.comments ?? 0,
        };
      }
      return {
        userId: s.id,
        name: s.name,
        designation: s.designation,
        attendance: att
          ? { daysPresent: att.daysPresent, inAt: iso(att.inAt), outAt: iso(att.outAt) }
          : s.attendanceType !== null
            ? { daysPresent: 0, inAt: null, outAt: null }
            : null,
        activity,
        target:
          tg && activity
            ? {
                month: tg.month,
                amount: targets.get(s.id)?.amount ?? 0,
                achieved: tg.achieved.get(s.id) ?? 0,
                carriedFrom: targets.get(s.id)?.carriedFrom ?? null,
              }
            : null,
      };
    })
    .sort((x, y) => x.name.localeCompare(y.name));
}
