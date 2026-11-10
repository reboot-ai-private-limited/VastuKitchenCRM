import type { ClientKind } from '@vastu/contracts';
import type { AccessTokenSignerPort } from '../../domain/accessTokenSigner.port.js';
import type { SessionRepositoryPort } from '../../domain/session.repository.port.js';
import type { TokenGeneratorPort } from '../../domain/tokenGenerator.port.js';
import type { User } from '../../domain/user.entity.js';

export interface IssuedSession {
  accessToken: string;
  /** Always returned here; the interface layer decides whether it travels as a cookie or a body. */
  refreshToken: string;
  expiresIn: number;
  /** When the refresh token (and so the cookie) stops being valid. */
  refreshExpiresAt: Date;
  user: User;
}

export interface SessionLifetimes {
  staffDays: number;
  customerDays: number;
}

/** Creates a session row + the token pair. Shared by login, refresh and invite redemption. */
export class SessionIssuer {
  constructor(
    private readonly sessions: SessionRepositoryPort,
    private readonly signer: AccessTokenSignerPort,
    private readonly tokens: TokenGeneratorPort,
    private readonly lifetimes: SessionLifetimes,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async issue(user: User, client: ClientKind): Promise<IssuedSession> {
    const { token, hash } = this.tokens.generate();
    const days = user.role === 'CUSTOMER' ? this.lifetimes.customerDays : this.lifetimes.staffDays;
    const refreshExpiresAt = new Date(this.now().getTime() + days * 86_400_000);

    await this.sessions.create({
      userId: user.id,
      tokenHash: hash,
      client,
      expiresAt: refreshExpiresAt,
    });
    const access = this.signer.sign(user.id, user.role);

    return {
      accessToken: access.token,
      refreshToken: token,
      expiresIn: access.expiresIn,
      refreshExpiresAt,
      user,
    };
  }
}
