import type { CreateUserBodyDto, RoleName } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import type { DesignationRepositoryPort } from '../../domain/designation.repository.port.js';
import type { PasswordHasherPort } from '../../domain/passwordHasher.port.js';
import type { User } from '../../domain/user.entity.js';
import type { UserRepositoryPort } from '../../domain/user.repository.port.js';
import { canAssignRole } from '../../domain/userManagement.policy.js';

export class CreateUserUseCase {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly designations: DesignationRepositoryPort,
    private readonly hasher: PasswordHasherPort,
  ) {}

  async execute(actorRole: RoleName, input: CreateUserBodyDto): Promise<User> {
    if (!canAssignRole(actorRole, input.role)) {
      throw AppError.forbidden('You cannot create an account with this role.');
    }

    const designation = await this.designations.findByName(input.designation);
    if (!designation || !designation.active) {
      throw AppError.badRequest('Choose a designation from the list.', [
        { path: ['designation'], message: 'Unknown or inactive designation' },
      ]);
    }
    if (await this.users.findByPhone(input.phone)) {
      throw AppError.conflict('A user with this phone number already exists.');
    }

    return this.users.create({
      name: input.name,
      phone: input.phone,
      role: input.role,
      // The master list's own spelling, so casing stays consistent across users.
      designation: designation.name,
      attendanceType: input.attendanceType,
      fixedSalary: input.fixedSalary,
      passwordHash: input.password ? await this.hasher.hash(input.password) : null,
      active: true,
    });
  }
}
