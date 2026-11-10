import { isValidObjectId, type HydratedDocument } from 'mongoose';
import { AppError } from '@/shared/errors/AppError.js';
import type { Designation } from '../domain/designation.entity.js';
import type { DesignationRepositoryPort } from '../domain/designation.repository.port.js';
import { DesignationModel, type DesignationDoc } from './designation.schema.js';
import { isDuplicateKey } from '@/shared/db/mongoErrors.js';

const toEntity = (doc: HydratedDocument<DesignationDoc>): Designation => ({
  id: doc.id as string,
  name: doc.name,
  active: doc.active,
});
const keyOf = (name: string) => name.trim().toLowerCase();

export class MongoDesignationRepository implements DesignationRepositoryPort {
  async list(includeInactive: boolean): Promise<Designation[]> {
    const docs = await DesignationModel.find(includeInactive ? {} : { active: true }).sort({
      nameKey: 1,
    });
    return docs.map(toEntity);
  }

  async findById(id: string): Promise<Designation | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await DesignationModel.findById(id);
    return doc ? toEntity(doc) : null;
  }

  async findByName(name: string): Promise<Designation | null> {
    const doc = await DesignationModel.findOne({ nameKey: keyOf(name) });
    return doc ? toEntity(doc) : null;
  }

  async create(name: string): Promise<Designation> {
    try {
      return toEntity(
        await DesignationModel.create({ name: name.trim(), nameKey: keyOf(name), active: true }),
      );
    } catch (err) {
      if (isDuplicateKey(err)) throw AppError.conflict('That designation already exists.');
      throw err;
    }
  }

  async update(
    id: string,
    patch: { name?: string; active?: boolean },
  ): Promise<Designation | null> {
    if (!isValidObjectId(id)) return null;
    const set: Record<string, unknown> = {};
    if (patch.active !== undefined) set['active'] = patch.active;
    if (patch.name !== undefined) {
      set['name'] = patch.name.trim();
      set['nameKey'] = keyOf(patch.name);
    }
    try {
      const doc = await DesignationModel.findByIdAndUpdate(id, { $set: set }, { new: true });
      return doc ? toEntity(doc) : null;
    } catch (err) {
      if (isDuplicateKey(err)) throw AppError.conflict('That designation already exists.');
      throw err;
    }
  }
}
