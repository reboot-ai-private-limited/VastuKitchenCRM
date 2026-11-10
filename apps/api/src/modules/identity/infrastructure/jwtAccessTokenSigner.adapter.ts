import type { RoleName } from '@vastu/contracts';
import { env } from '@/config/env.js';
import { signAccessToken } from '@/shared/http/jwt.util.js';
import type { AccessTokenSignerPort } from '../domain/accessTokenSigner.port.js';

export class JwtAccessTokenSigner implements AccessTokenSignerPort {
  sign(userId: string, role: RoleName): { token: string; expiresIn: number } {
    return { token: signAccessToken(userId, role), expiresIn: env.JWT_ACCESS_TTL_SECONDS };
  }
}
