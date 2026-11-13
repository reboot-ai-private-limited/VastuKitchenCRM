import type { SetTargetBodyDto, TargetRowDto, TargetsSheetDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import type { SalesTarget } from '../../domain/hr.entity.js';
import type { SalesTargetRepositoryPort, StaffDirectoryPort } from '../../domain/ports.js';
import type { BusinessClock } from '../services/clock.js';

/**
 * The target each person has for a month. A month nobody set carries forward the most recent
 * earlier month's amount (marked `carriedFrom`), so targets only need editing when they change.
 * A target of 0 is a real value: it stops the carry-forward.
 */
export async function targetsFor(
  repo: SalesTargetRepositoryPort,
  month: string,
): Promise<TargetRowDto[]> {
  const latest = new Map<string, SalesTarget>();
  for (const t of await repo.upToMonth(month)) {
    const cur = latest.get(t.userId);
    if (!cur || t.month > cur.month) latest.set(t.userId, t);
  }
  return [...latest.values()].map((t) => ({
    userId: t.userId,
    amount: t.amount,
    carriedFrom: t.month === month ? null : t.month,
  }));
}

export class GetTargetsUseCase {
  constructor(private readonly targets: SalesTargetRepositoryPort) {}

  async execute(month: string): Promise<TargetsSheetDto> {
    return { month, rows: await targetsFor(this.targets, month) };
  }
}

export class SetTargetUseCase {
  constructor(
    private readonly staff: StaffDirectoryPort,
    private readonly targets: SalesTargetRepositoryPort,
    private readonly clock: BusinessClock,
  ) {}

  async execute(
    actorId: string,
    month: string,
    userId: string,
    input: SetTargetBodyDto,
  ): Promise<TargetsSheetDto> {
    const person = (await this.staff.all()).find((s) => s.id === userId);
    if (!person) throw AppError.notFound('No such employee.');
    await this.targets.set(month, userId, input.amount, actorId, this.clock.now());
    return new GetTargetsUseCase(this.targets).execute(month);
  }
}
