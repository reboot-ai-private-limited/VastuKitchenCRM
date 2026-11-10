import type { ClientKind } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import type { PasswordHasherPort } from '../../domain/passwordHasher.port.js';
import type { UserRepositoryPort } from '../../domain/user.repository.port.js';
import type { IssuedSession, SessionIssuer } from '../services/sessionIssuer.js';

export class LoginUseCase {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly hasher: PasswordHasherPort,
    private readonly issuer: SessionIssuer,
  ) {}

  async execute(
    input: { phone: string; password: string },
    client: ClientKind,
  ): Promise<IssuedSession> {
    const user = await this.users.findByPhone(input.phone);
    // Verify even when there is no user / no password so timing does not reveal which numbers exist.
    const passwordOk = await this.hasher.verify(input.password, user?.passwordHash ?? null);

    // One answer for every failure: unknown number, wrong password, no login, deactivated.
    if (!user || !passwordOk || !user.active) {
      throw new AppError({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Incorrect phone number or password.',
      });
    }
    return this.issuer.issue(user, client);
  }
}
