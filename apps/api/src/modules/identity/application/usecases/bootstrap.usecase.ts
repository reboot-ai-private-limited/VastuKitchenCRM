import { AppError } from '@/shared/errors/AppError.js';
import type { DesignationRepositoryPort } from '../../domain/designation.repository.port.js';
import type { PasswordHasherPort } from '../../domain/passwordHasher.port.js';
import type { User } from '../../domain/user.entity.js';
import type { UserRepositoryPort } from '../../domain/user.repository.port.js';

export const DEFAULT_DESIGNATIONS = [
  'Owner',
  'Sales Executive',
  'Telecaller',
  'Field Sales Executive',
  'Designer',
  'Senior Designer',
  'Technician',
  'Receptionist',
  'Front Desk',
  'Floor Staff',
  'Office Boy',
  'HR Executive',
] as const;

/** Idempotent: adds any default that is missing, never touches existing entries. */
export class SeedDesignationsUseCase {
  constructor(private readonly designations: DesignationRepositoryPort) {}

  async execute(): Promise<string[]> {
    const added: string[] = [];
    for (const name of DEFAULT_DESIGNATIONS) {
      if (!(await this.designations.findByName(name))) {
        await this.designations.create(name);
        added.push(name);
      }
    }
    return added;
  }
}

/** Creates the first Admin. Refuses once any active Admin exists. Run by the seed script. */
export class BootstrapAdminUseCase {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly hasher: PasswordHasherPort,
  ) {}

  async execute(input: { name: string; phone: string; password: string }): Promise<User> {
    if (await this.users.hasActiveAdmin()) throw AppError.conflict('An Admin already exists.');
    if (await this.users.findByPhone(input.phone))
      throw AppError.conflict('That phone number is already in use.');
    return this.users.create({
      name: input.name,
      phone: input.phone,
      role: 'ADMIN',
      designation: 'Owner',
      // The owner is not on attendance or payroll; an Admin can be set to GPS/Biometric later.
      attendanceType: null,
      fixedSalary: 0,
      passwordHash: await this.hasher.hash(input.password),
      active: true,
    });
  }
}
