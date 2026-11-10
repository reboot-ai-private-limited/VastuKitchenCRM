import type { Designation } from './designation.entity.js';

export interface DesignationRepositoryPort {
  list(includeInactive: boolean): Promise<Designation[]>;
  findById(id: string): Promise<Designation | null>;
  /** Case-insensitive match on the name. */
  findByName(name: string): Promise<Designation | null>;
  /** Throws `AppError.conflict` if the name (case-insensitive) already exists. */
  create(name: string): Promise<Designation>;
  update(id: string, patch: { name?: string; active?: boolean }): Promise<Designation | null>;
}
