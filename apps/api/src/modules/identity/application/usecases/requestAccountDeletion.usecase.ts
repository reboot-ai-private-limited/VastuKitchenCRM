import { AppError } from '@/shared/errors/AppError.js';
import type { EventBus } from '@/shared/events/appEvents.js';
import type { DeletionRequestRepositoryPort } from '../../domain/deletionRequest.repository.port.js';
import type { SessionRepositoryPort } from '../../domain/session.repository.port.js';
import type { UserRepositoryPort } from '../../domain/user.repository.port.js';

/**
 * A signed-in person asks for their own account to be deleted (a Play Store requirement).
 * It records the request, deactivates the account, signs it out everywhere and tells the Admins
 * (through the event bus, so this module never imports notifications). Projects, posts and
 * attendance stay; an Admin carries out the anonymisation. Asking twice is harmless.
 */
export class RequestAccountDeletionUseCase {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly sessions: SessionRepositoryPort,
    private readonly requests: DeletionRequestRepositoryPort,
    private readonly events: EventBus,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(userId: string, reason?: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw AppError.unauthenticated();
    // Already deactivated by an earlier request (the access token outlives it by minutes): done.
    if (!user.active) return;

    if (user.role === 'ADMIN') {
      const admins = await this.users.findActiveIdsByRole('ADMIN');
      if (admins.every((id) => id === user.id))
        throw AppError.conflict(
          'You are the only active Admin. Make another person an Admin before deleting this account.',
        );
    }

    const request = await this.requests.create({
      userId: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      reason: reason?.trim() || null,
      requestedAt: this.now(),
    });
    await this.users.update(user.id, { active: false });
    await this.sessions.revokeAllForUser(user.id);
    this.events.emit('user.deactivated', { userId: user.id });
    this.events.emit('account.deletion-requested', {
      requestId: request.id,
      userId: user.id,
      name: user.name,
      role: user.role,
    });
  }
}
