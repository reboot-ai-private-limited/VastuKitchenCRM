import jwt from 'jsonwebtoken';
import { accessTokenPayloadSchema, type AccessTokenPayload, type RoleName } from '@vastu/contracts';
import { env } from '@/config/env.js';

/**
 * Access tokens are stateless: verified by signature and expiry only, no DB lookup, so everything
 * an authorization check needs (`sub`, `role`) is baked in at sign time.
 * Lives in `shared/` because the `authenticate` middleware (below every module) verifies them.
 */
export function signAccessToken(userId: string, role: RoleName): string {
  return jwt.sign({ role }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    subject: userId,
    expiresIn: env.JWT_ACCESS_TTL_SECONDS,
  });
}

/** Returns the payload, or `null` for anything wrong (bad signature, expired, malformed). */
export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
    const parsed = accessTokenPayloadSchema.safeParse(decoded);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
