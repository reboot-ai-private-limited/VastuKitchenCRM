import type { ClientKind } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import type { Session } from '../../domain/session.entity.js';
import type { SessionRepositoryPort } from '../../domain/session.repository.port.js';
import type { TokenGeneratorPort } from '../../domain/tokenGenerator.port.js';
import type { UserRepositoryPort } from '../../domain/user.repository.port.js';
import type { IssuedSession, SessionIssuer } from '../services/sessionIssuer.js';

const invalid = () =>
  new AppError({
    statusCode: 401,
    code: 'TOKEN_INVALID',
    message: 'Your session has expired. Please sign in again.',
  });

/**
 * Rotates the refresh token: the presented one is spent and a new one issued. Presenting a token
 * that was ALREADY spent means it leaked (or a device replayed it), so every session of that
 * user is revoked and they must sign in again.
 *
 * Grace window: a token spent by a refresh may be presented ONCE more within `graceMs` (a lost
 * response, a second tab). That replay gets a fresh session and revokes nothing; any further
 * replay, or one after the window, is treated as theft. Raw tokens are never stored, so the
 * replay cannot be handed "the same successor"; it gets a new one.
 */
export class RefreshSessionUseCase {
  constructor(
    private readonly sessions: SessionRepositoryPort,
    private readonly users: UserRepositoryPort,
    private readonly tokens: TokenGeneratorPort,
    private readonly issuer: SessionIssuer,
    private readonly graceMs: number = 0,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(refreshToken: string, client: ClientKind): Promise<IssuedSession> {
    const hash = this.tokens.hash(refreshToken);
    const session = await this.sessions.findByTokenHash(hash);
    if (!session) throw invalid();

    let consumed: Session | null;
    if (session.revokedAt) {
      // Only a token spent by rotation (not logout / revoke-all) is eligible, once, inside the window.
      const replay =
        this.graceMs > 0 && session.rotatedAt
          ? await this.sessions.claimGrace(hash, this.now(), this.graceMs)
          : null;
      if (!replay) {
        await this.sessions.revokeAllForUser(session.userId);
        throw invalid();
      }
      consumed = replay;
    } else {
      if (session.expiresAt <= this.now()) throw invalid();
      // Atomic: of two concurrent refreshes with the same token, only one gets the session back.
      consumed = await this.sessions.consume(hash, this.now());
      if (!consumed) throw invalid();
    }

    const user = await this.users.findById(consumed.userId);
    if (!user || !user.active) {
      await this.sessions.revokeAllForUser(consumed.userId);
      throw invalid();
    }
    return this.issuer.issue(user, client);
  }
}
