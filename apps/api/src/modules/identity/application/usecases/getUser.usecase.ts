import { AppError } from '@/shared/errors/AppError.js';
import type { User } from '../../domain/user.entity.js';
import type { UserRepositoryPort } from '../../domain/user.repository.port.js';

export class GetUserUseCase {
  constructor(private readonly users: UserRepositoryPort) {}

  async execute(id: string): Promise<User> {
    const user = await this.users.findById(id);
    if (!user) throw AppError.notFound('User not found.');
    return user;
  }
}
