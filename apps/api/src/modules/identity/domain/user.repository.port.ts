import type { RoleName } from '@vastu/contracts';
import type { NewUser, User, UserListFilter } from './user.entity.js';

export interface UserRepositoryPort {
  findById(id: string): Promise<User | null>;
  findByPhone(phone: string): Promise<User | null>;
  findByIds(ids: string[]): Promise<User[]>;
  /** Throws `AppError.conflict` if the phone is already taken. */
  create(user: NewUser): Promise<User>;
  update(
    id: string,
    patch: Partial<Omit<User, 'id' | 'createdAt' | 'phone'>>,
  ): Promise<User | null>;
  list(filter: UserListFilter): Promise<{ items: User[]; total: number }>;
  /** Rewrites the copied designation text on every user that holds `from`. Returns how many. */
  renameDesignation(from: string, to: string): Promise<number>;
  hasActiveAdmin(): Promise<boolean>;
  /** Ids of active users with this role (e.g. every active Admin, for alerts that need someone). */
  findActiveIdsByRole(role: RoleName): Promise<string[]>;
}
