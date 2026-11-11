import type { ClientKind } from '@vastu/contracts';

/** One signed-in device. Holds only the HASH of its refresh token. */
export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  client: ClientKind;
  expiresAt: Date;
  revokedAt: Date | null;
  /** Set when the token was spent by a refresh (not by logout/revoke-all): only these may be replayed in the grace window. */
  rotatedAt: Date | null;
  /** Set when the one allowed grace replay was used. */
  graceUsedAt: Date | null;
}

export type NewSession = Omit<Session, 'id' | 'revokedAt' | 'rotatedAt' | 'graceUsedAt'>;
