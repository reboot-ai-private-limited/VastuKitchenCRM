import { isValidObjectId, type HydratedDocument } from 'mongoose';
import type { RoleName } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import type { NewUser, User, UserListFilter } from '../domain/user.entity.js';
import type { UserRepositoryPort } from '../domain/user.repository.port.js';
import { escapeRegex, isDuplicateKey } from '@/shared/db/mongoErrors.js';
import { UserModel, type UserDoc } from './user.schema.js';

function toEntity(doc: HydratedDocument<UserDoc>): User {
  return {
    id: doc.id as string,
    name: doc.name,
    phone: doc.phone,
    role: doc.role,
    designation: doc.designation,
    attendanceType: doc.attendanceType,
    fixedSalary: doc.fixedSalary,
    passwordHash: doc.passwordHash,
    active: doc.active,
    createdAt: doc.createdAt,
  };
}

export class MongoUserRepository implements UserRepositoryPort {
  async findById(id: string): Promise<User | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await UserModel.findById(id);
    return doc ? toEntity(doc) : null;
  }

  async findByPhone(phone: string): Promise<User | null> {
    const doc = await UserModel.findOne({ phone });
    return doc ? toEntity(doc) : null;
  }

  async findByIds(ids: string[]): Promise<User[]> {
    const valid = ids.filter((id) => isValidObjectId(id));
    return (await UserModel.find({ _id: { $in: valid } })).map(toEntity);
  }

  async create(user: NewUser): Promise<User> {
    try {
      return toEntity(await UserModel.create(user));
    } catch (err) {
      if (isDuplicateKey(err))
        throw AppError.conflict('A user with this phone number already exists.');
      throw err;
    }
  }

  async update(
    id: string,
    patch: Parameters<UserRepositoryPort['update']>[1],
  ): Promise<User | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await UserModel.findByIdAndUpdate(id, { $set: patch }, { new: true });
    return doc ? toEntity(doc) : null;
  }

  async list(filter: UserListFilter): Promise<{ items: User[]; total: number }> {
    const query: Record<string, unknown> = {};
    // Customers are not employees: left out unless that role is asked for explicitly.
    query['role'] = filter.role ?? { $ne: 'CUSTOMER' };
    if (filter.active !== undefined) query['active'] = filter.active;
    if (filter.search) {
      const rx = new RegExp(escapeRegex(filter.search), 'i');
      query['$or'] = [{ name: rx }, { phone: rx }, { designation: rx }];
    }
    const [docs, total] = await Promise.all([
      UserModel.find(query)
        .sort({ createdAt: -1 })
        .skip((filter.page - 1) * filter.pageSize)
        .limit(filter.pageSize),
      UserModel.countDocuments(query),
    ]);
    return { items: docs.map(toEntity), total };
  }

  async renameDesignation(from: string, to: string): Promise<number> {
    const res = await UserModel.updateMany({ designation: from }, { $set: { designation: to } });
    return res.modifiedCount;
  }

  async findActiveIdsByRole(role: RoleName): Promise<string[]> {
    const docs = await UserModel.find({ role, active: true }).select('_id');
    return docs.map((d) => d.id as string);
  }

  async findStaff(): Promise<User[]> {
    return (await UserModel.find({ role: { $ne: 'CUSTOMER' } }).sort({ name: 1 })).map(toEntity);
  }

  async hasActiveAdmin(): Promise<boolean> {
    return (await UserModel.exists({ role: 'ADMIN', active: true })) !== null;
  }
}
