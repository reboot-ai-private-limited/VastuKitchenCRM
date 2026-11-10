import type { SessionRepositoryPort } from '../../domain/session.repository.port.js';
import type { TokenGeneratorPort } from '../../domain/tokenGenerator.port.js';

/** Idempotent: an unknown or already-revoked token is simply a no-op. */
export class LogoutUseCase {
  constructor(
    private readonly sessions: SessionRepositoryPort,
    private readonly tokens: TokenGeneratorPort,
  ) {}

  async execute(refreshToken: string): Promise<void> {
    await this.sessions.revokeByTokenHash(this.tokens.hash(refreshToken));
  }
}
