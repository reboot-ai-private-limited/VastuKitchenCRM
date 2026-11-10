import type { ListUsersQueryDto } from '@vastu/contracts';
import type { User } from '../../domain/user.entity.js';
import type { UserRepositoryPort } from '../../domain/user.repository.port.js';

export class ListUsersUseCase {
  constructor(private readonly users: UserRepositoryPort) {}

  async execute(query: ListUsersQueryDto): Promise<{ items: User[]; total: number }> {
    return this.users.list(query);
  }
}
