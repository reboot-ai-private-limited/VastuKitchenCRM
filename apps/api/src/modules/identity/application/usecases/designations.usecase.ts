import type { UpdateDesignationBodyDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import type { Designation } from '../../domain/designation.entity.js';
import type { DesignationRepositoryPort } from '../../domain/designation.repository.port.js';
import type { UserRepositoryPort } from '../../domain/user.repository.port.js';

export class ListDesignationsUseCase {
  constructor(private readonly designations: DesignationRepositoryPort) {}

  execute(includeInactive: boolean): Promise<Designation[]> {
    return this.designations.list(includeInactive);
  }
}

export class CreateDesignationUseCase {
  constructor(private readonly designations: DesignationRepositoryPort) {}

  execute(name: string): Promise<Designation> {
    return this.designations.create(name);
  }
}

/**
 * Rename and/or (de)activate. Users hold a COPY of the designation text, so a rename also
 * rewrites it on every user that has the old text. Deactivating only hides the entry from the
 * dropdown; existing users keep their text.
 */
export class UpdateDesignationUseCase {
  constructor(
    private readonly designations: DesignationRepositoryPort,
    private readonly users: UserRepositoryPort,
  ) {}

  async execute(id: string, input: UpdateDesignationBodyDto): Promise<Designation> {
    const current = await this.designations.findById(id);
    if (!current) throw AppError.notFound('Designation not found.');

    // Captured now: the repository may hand back a live object that the update below mutates.
    const oldName = current.name;
    const patch: { name?: string; active?: boolean } = {};
    if (input.active !== undefined) patch.active = input.active;
    if (input.name !== undefined && input.name !== current.name) {
      const clash = await this.designations.findByName(input.name);
      if (clash && clash.id !== id) throw AppError.conflict('That designation already exists.');
      patch.name = input.name;
    }

    const updated = await this.designations.update(id, patch);
    if (!updated) throw AppError.notFound('Designation not found.');
    if (patch.name !== undefined) await this.users.renameDesignation(oldName, patch.name);
    return updated;
  }
}
