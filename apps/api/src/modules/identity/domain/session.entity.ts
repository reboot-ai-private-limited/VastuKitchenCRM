import type { ClientKind } from '@vastu/contracts';

/** One signed-in device. Holds only the HASH of its refresh token. */
export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  client: ClientKind;
  expiresAt: Date;
  revokedAt: Date | null;
}

export type NewSession = Omit<Session, 'id' | 'revokedAt'>;
