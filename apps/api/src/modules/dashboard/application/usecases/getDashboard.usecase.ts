import {
  CLOSED_LEAD_STATUSES,
  MAX_DASHBOARD_DAYS,
  type DashboardBlockName,
  type DashboardCountersDto,
  type DashboardDto,
  type DashboardQueryDto,
} from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import { logger } from '@/shared/logging/logger.js';
import type { BusinessClock } from '@/shared/time/businessClock.js';
import { addDays } from '@/shared/time/businessDate.js';
import type {
  ComplaintsSource,
  DirectorySource,
  HrSource,
  LeadsSource,
  ProjectsSource,
  ProposalsSource,
  ThresholdsPort,
  TodosSource,
} from '../../domain/ports.js';
import { AttentionBuilder } from '../services/attention.js';
import { buildPeople, type PeopleTargets } from '../services/people.js';

export interface DashboardSources {
  leads: LeadsSource;
  proposals: ProposalsSource;
  projects: ProjectsSource;
  complaints: ComplaintsSource;
  todos: TodosSource;
  hr: HrSource;
  directory: DirectorySource;
  thresholds: ThresholdsPort;
}

/** Open leads valued per request, at most (a pipeline bigger than this is flagged, not guessed). */
export const VALUE_LEAD_CAP = 2000;
const RECENT_FEED = 15;
const logTargetFailure = (err: unknown): null => {
  logger.error({ err: String(err), block: 'targets' }, 'dashboard targets failed');
  return null;
};
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;

/**
 * The owner's one screen. Read-only: it asks other modules' public contracts and merges the
 * answers; it stores nothing. Admin sees everything; HR sees only attendance. Each block is loaded
 * on its own, so one failing source blanks its block (and is named in `errors`), not the page.
 */
export class GetDashboardUseCase {
  private readonly attention: AttentionBuilder;

  constructor(
    private readonly src: DashboardSources,
    private readonly clock: BusinessClock,
  ) {
    this.attention = new AttentionBuilder(src);
  }

  async execute(actor: { role: string }, query: DashboardQueryDto): Promise<DashboardDto> {
    const now = this.clock.now();
    const today = this.clock.dateOf(now);
    const from = query.from ?? query.to ?? today;
    const to = query.to ?? query.from ?? today;
    if (from > to) throw AppError.badRequest('"from" must not be after "to".');
    if (daysBetween(from, to) > MAX_DASHBOARD_DAYS)
      throw AppError.badRequest(`Pick at most ${MAX_DASHBOARD_DAYS} days.`);

    const start = this.clock.at(from, '00:00');
    const end = this.clock.at(addDays(to, 1), '00:00');
    const isAdmin = actor.role === 'ADMIN';
    const errors: DashboardBlockName[] = [];
    const load = async <T>(name: DashboardBlockName, fn: () => Promise<T>): Promise<T | null> => {
      try {
        return await fn();
      } catch (err) {
        logger.error({ err: String(err), block: name }, 'dashboard block failed');
        errors.push(name);
        return null;
      }
    };

    const [counters, staff, people, attention, recent] = await Promise.all([
      isAdmin ? load('counters', () => this.counters(start, end)) : null,
      load('staff', () => this.src.hr.dayCounts(today)),
      load('people', () => this.people(isAdmin, from, to, start, end)),
      isAdmin ? load('attention', () => this.attentionBlocks(now)) : null,
      isAdmin ? load('recent', () => this.recent()) : null,
    ]);

    return {
      range: { from, to },
      generatedAt: now.toISOString(),
      counters,
      staff,
      people,
      attention,
      recent,
      errors,
    };
  }

  private async counters(start: Date, end: Date): Promise<DashboardCountersDto> {
    const [leads, stages, complaints, value] = await Promise.all([
      this.src.leads.dashboardCounts(start, end),
      this.src.projects.countByStage(),
      this.src.complaints.countByStatus(),
      this.value(start, end),
    ]);
    const open = Object.entries(leads.byStatus)
      .filter(([status]) => !(CLOSED_LEAD_STATUSES as readonly string[]).includes(status))
      .reduce((sum, [, n]) => sum + n, 0);
    return {
      leads: { open, byStatus: leads.byStatus, newInRange: leads.createdInRange },
      projects: { design: stages.DESIGN, site: stages.SITE, running: stages.DESIGN + stages.SITE },
      complaints: {
        ...complaints,
        pending: complaints.OPEN + complaints.ASSIGNED + complaints.RESOLVED,
      },
      value,
    };
  }

  /** Pipeline = open leads' latest sent proposal; won = leads won in the range, the same way. */
  private async value(start: Date, end: Date): Promise<DashboardCountersDto['value']> {
    const [openIds, wonIds] = await Promise.all([
      this.src.leads.openLeadIds(VALUE_LEAD_CAP),
      this.src.leads.wonLeadIds(start, end, VALUE_LEAD_CAP),
    ]);
    const totals = new Map(
      (await this.src.proposals.latestSentTotals([...new Set([...openIds, ...wonIds])])).map(
        (t) => [t.leadId, t.total],
      ),
    );
    const sum = (ids: string[]) => ids.reduce((s, id) => s + (totals.get(id) ?? 0), 0);
    return {
      pipeline: sum(openIds),
      wonInRange: sum(wonIds),
      pipelineCapped: openIds.length >= VALUE_LEAD_CAP,
    };
  }

  private async people(isAdmin: boolean, from: string, to: string, start: Date, end: Date) {
    const [staff, attendance, activity] = await Promise.all([
      this.src.directory.getStaff(),
      this.src.hr.attendanceSummary(from, to),
      isAdmin
        ? Promise.all([
            this.src.leads.activitySummary(start, end),
            this.src.leads.callStats(start, end),
            this.src.proposals.activitySummary(start, end),
            this.src.projects.feedActivitySummary(start, end),
          ]).then(([leads, calls, proposals, feed]) => ({ leads, calls, proposals, feed }))
        : Promise.resolve(null),
    ]);
    // Targets are a bonus column: if they fail to load, everything else still shows.
    const targets = isAdmin ? await this.targets(to, end).catch(logTargetFailure) : null;
    return buildPeople({ staff, attendance, activity, targets });
  }

  /** The month of the range's end: its targets, and what each person has won in it so far. */
  private async targets(to: string, end: Date): Promise<PeopleTargets> {
    const month = to.slice(0, 7);
    const [rows, won] = await Promise.all([
      this.src.hr.targetsForMonth(month),
      this.src.leads.wonLeads(this.clock.at(`${month}-01`, '00:00'), end, VALUE_LEAD_CAP),
    ]);
    const totals = new Map(
      (await this.src.proposals.latestSentTotals(won.map((w) => w.leadId))).map((t) => [
        t.leadId,
        t.total,
      ]),
    );
    const achieved = new Map<string, number>();
    for (const w of won)
      if (w.assignedToId)
        achieved.set(
          w.assignedToId,
          (achieved.get(w.assignedToId) ?? 0) + (totals.get(w.leadId) ?? 0),
        );
    return { month, targets: rows, achieved };
  }

  private async attentionBlocks(now: Date) {
    const t = await this.src.thresholds.load();
    const [unseenProposals, noActionProposals, stagnantLeads, overdueComplaints, overdueTodos] =
      await Promise.all([
        this.attention.unseenProposals(now, t),
        this.attention.noActionProposals(now, t),
        this.attention.stagnantLeads(now, t),
        this.attention.overdueComplaints(now, t),
        this.attention.overdueTodos(),
      ]);
    return { unseenProposals, noActionProposals, stagnantLeads, overdueComplaints, overdueTodos };
  }

  private async recent() {
    const items = await this.src.projects.recentCustomerActivity(RECENT_FEED);
    if (items.length === 0) return [];
    const [projects, users] = await Promise.all([
      this.src.projects.getProjectNames([...new Set(items.map((i) => i.projectId))]),
      this.src.directory.getUserSummaries([...new Set(items.map((i) => i.authorId))]),
    ]);
    const projectName = new Map(projects.map((p) => [p.id, p.name]));
    const userName = new Map(users.map((u) => [u.id, u.name]));
    return items.flatMap((i) => {
      const name = projectName.get(i.projectId);
      return name
        ? [
            {
              kind: i.kind,
              at: i.at.toISOString(),
              projectId: i.projectId,
              projectName: name,
              postId: i.postId,
              authorName: userName.get(i.authorId) ?? 'Customer',
              snippet: i.snippet,
              hasPhotos: i.hasPhotos,
            },
          ]
        : [];
    });
  }
}
