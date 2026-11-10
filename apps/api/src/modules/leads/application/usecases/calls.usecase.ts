import type { CallStatsQueryDto, RecordCallBodyDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import type { CallRecord, CallStat } from '../../domain/call.entity.js';
import type { CallRepositoryPort } from '../../domain/call.repository.port.js';
import type { LeadActivityRepositoryPort } from '../../domain/leadActivity.repository.port.js';
import type { LeadRepositoryPort } from '../../domain/lead.repository.port.js';
import type { UserDirectoryPort } from '../../domain/userDirectory.port.js';
import type { Actor, LeadAccess } from '../services/leadAccess.js';
import { nameMap } from '../services/leadViews.js';

/** A phone's clock may be a little ahead; anything further in the future is a bad upload. */
const CLOCK_SKEW_MS = 5 * 60_000;

export interface CallView {
  call: CallRecord;
  userName: string;
  /** False when this exact call was already recorded (an app retry). */
  created: boolean;
}

/**
 * Records a call the mobile app read from the phone's call log. Idempotent. The first call on a
 * NEW lead moves it to CONTACTED, as the pipeline expects.
 */
export class RecordCallUseCase {
  constructor(
    private readonly access: LeadAccess,
    private readonly calls: CallRepositoryPort,
    private readonly leads: LeadRepositoryPort,
    private readonly activities: LeadActivityRepositoryPort,
    private readonly directory: UserDirectoryPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(actor: Actor, leadId: string, input: RecordCallBodyDto): Promise<CallView> {
    // Same rule as everything else: you can only log calls on leads you may access.
    const lead = await this.access.load(leadId, actor);
    const now = this.now();
    if (input.startedAt.getTime() > now.getTime() + CLOCK_SKEW_MS) {
      throw AppError.badRequest('The call start time is in the future.', [
        { path: ['startedAt'], message: 'Must not be in the future' },
      ]);
    }

    const { call, created } = await this.calls.record({
      leadId,
      userId: actor.id,
      startedAt: input.startedAt,
      durationSec: input.durationSec,
      answered: input.answered,
      outcome: input.outcome ?? null,
      note: input.note ?? null,
    });

    if (created) {
      await this.activities.add({
        leadId,
        type: 'CALL',
        byUserId: actor.id,
        at: input.startedAt,
        data: { answered: call.answered, durationSec: call.durationSec, outcome: call.outcome },
      });
      if (lead.status === 'NEW') {
        await this.leads.update(leadId, { status: 'CONTACTED', statusChangedAt: now });
        await this.activities.add({
          leadId,
          type: 'STATUS_CHANGED',
          byUserId: actor.id,
          at: now,
          data: { from: 'NEW', to: 'CONTACTED', auto: true },
        });
      }
    }

    const names = await nameMap(this.directory, [actor.id]);
    return { call, created, userName: names.get(actor.id) ?? '' };
  }
}

export class ListCallsUseCase {
  constructor(
    private readonly access: LeadAccess,
    private readonly calls: CallRepositoryPort,
    private readonly directory: UserDirectoryPort,
  ) {}

  async execute(actor: Actor, leadId: string): Promise<CallView[]> {
    await this.access.load(leadId, actor);
    const items = await this.calls.listByLead(leadId);
    const names = await nameMap(
      this.directory,
      items.map((c) => c.userId),
    );
    return items.map((call) => ({ call, userName: names.get(call.userId) ?? '', created: false }));
  }
}

export interface CallStatView {
  stat: CallStat;
  userName: string;
}

/** Calls, answered calls and talk time per employee: the performance numbers (Admin). */
export class GetCallStatsUseCase {
  constructor(
    private readonly calls: CallRepositoryPort,
    private readonly directory: UserDirectoryPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(query: CallStatsQueryDto): Promise<CallStatView[]> {
    // Default window: today (server local time) up to the next midnight.
    const startOfToday = new Date(this.now());
    startOfToday.setHours(0, 0, 0, 0);
    const from = query.from ?? startOfToday;
    const to = query.to ?? new Date(from.getTime() + 86_400_000);
    if (to <= from) throw AppError.badRequest('`to` must be after `from`.');

    const stats = await this.calls.statsByUser(from, to);
    const names = await nameMap(
      this.directory,
      stats.map((s) => s.userId),
    );
    return stats
      .map((stat) => ({ stat, userName: names.get(stat.userId) ?? 'Unknown' }))
      .sort((a, b) => b.stat.calls - a.stat.calls);
  }
}
