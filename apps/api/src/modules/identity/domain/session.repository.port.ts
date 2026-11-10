import type { NewSession, Session } from './session.entity.js';

export interface SessionRepositoryPort {
  create(session: NewSession): Promise<Session>;
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  /**
   * Revokes the session if it is still live, atomically. Returns it, or null when it was already
   * revoked/expired — which is how two concurrent refreshes with one token cannot both win.
   */
  consume(tokenHash: string, now: Date): Promise<Session | null>;
  revokeByTokenHash(tokenHash: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}
