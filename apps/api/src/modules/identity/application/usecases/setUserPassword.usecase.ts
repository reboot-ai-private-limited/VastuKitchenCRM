import type { RoleName } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import type { PasswordHasherPort } from '../../domain/passwordHasher.port.js';
import type { SessionRepositoryPort } from '../../domain/session.repository.port.js';
import type { UserRepositoryPort } from '../../domain/user.repository.port.js';
import { canManageUser } from '../../domain/userManagement.policy.js';

/** Admin/HR set or reset someone's password. Also how a no-login employee is given a login. */
export class SetUserPasswordUseCase {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly hasher: PasswordHasherPort,
    private readonly sessions: SessionRepositoryPort,
  ) {}

  async execute(actorRole: RoleName, targetId: string, password: string): Promise<void> {
    const target = await this.users.findById(targetId);
    if (!target) throw AppError.notFound('User not found.');
    if (!canManageUser(actorRole, target.role)) throw AppError.forbidden();

    await this.users.update(targetId, { passwordHash: await this.hasher.hash(password) });
    await this.sessions.revokeAllForUser(targetId);
  }
}
