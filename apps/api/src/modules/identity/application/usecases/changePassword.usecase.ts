import { AppError } from '@/shared/errors/AppError.js';
import type { PasswordHasherPort } from '../../domain/passwordHasher.port.js';
import type { SessionRepositoryPort } from '../../domain/session.repository.port.js';
import type { UserRepositoryPort } from '../../domain/user.repository.port.js';

/** Changes the caller's own password and signs them out everywhere (they sign in again). */
export class ChangePasswordUseCase {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly hasher: PasswordHasherPort,
    private readonly sessions: SessionRepositoryPort,
  ) {}

  async execute(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw AppError.unauthenticated();

    if (!(await this.hasher.verify(currentPassword, user.passwordHash))) {
      throw AppError.badRequest('Your current password is not correct.');
    }
    await this.users.update(userId, { passwordHash: await this.hasher.hash(newPassword) });
    await this.sessions.revokeAllForUser(userId);
  }
}
