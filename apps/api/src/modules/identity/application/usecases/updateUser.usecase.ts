import type { RoleName, UpdateUserBodyDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import type { DesignationRepositoryPort } from '../../domain/designation.repository.port.js';
import type { SessionRepositoryPort } from '../../domain/session.repository.port.js';
import type { User } from '../../domain/user.entity.js';
import type { UserRepositoryPort } from '../../domain/user.repository.port.js';
import { canAssignRole, canManageUser } from '../../domain/userManagement.policy.js';

export class UpdateUserUseCase {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly designations: DesignationRepositoryPort,
    private readonly sessions: SessionRepositoryPort,
  ) {}

  async execute(
    actor: { id: string; role: RoleName },
    targetId: string,
    input: UpdateUserBodyDto,
  ): Promise<User> {
    const target = await this.users.findById(targetId);
    if (!target) throw AppError.notFound('User not found.');
    if (!canManageUser(actor.role, target.role)) throw AppError.forbidden();

    // Nobody can demote or deactivate themselves — keeps at least the acting admin in place.
    if (actor.id === target.id && (input.role !== undefined || input.active === false)) {
      throw AppError.forbidden('You cannot change your own role or deactivate yourself.');
    }
    if (input.role !== undefined && !canAssignRole(actor.role, input.role)) {
      throw AppError.forbidden('You cannot give an account this role.');
    }

    const patch: Parameters<UserRepositoryPort['update']>[1] = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.role !== undefined) patch.role = input.role;
    if (input.attendanceType !== undefined) patch.attendanceType = input.attendanceType;
    if (input.fixedSalary !== undefined) patch.fixedSalary = input.fixedSalary;
    if (input.active !== undefined) patch.active = input.active;

    if (input.designation !== undefined) {
      const designation = await this.designations.findByName(input.designation);
      // Keeping the user's current text is always fine, even if that entry was deactivated since.
      const unchanged = designation?.name === target.designation;
      if (!designation || (!designation.active && !unchanged)) {
        throw AppError.badRequest('Choose a designation from the list.', [
          { path: ['designation'], message: 'Unknown or inactive designation' },
        ]);
      }
      patch.designation = designation.name;
    }

    const updated = await this.users.update(targetId, patch);
    if (!updated) throw AppError.notFound('User not found.');
    // A deactivated or re-roled account must sign in again; an already-issued access token lives
    // until it expires (<= JWT_ACCESS_TTL_SECONDS).
    if (input.active === false || input.role !== undefined)
      await this.sessions.revokeAllForUser(targetId);
    return updated;
  }
}
