import type { NewSession, Session } from './session.entity.js';

export interface SessionRepositoryPort {
  create(session: NewSession): Promise<Session>;
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  /**
   * Revokes the session if it is still live, atomically. Returns it, or null when it was already
   * revoked/expired — which is how two concurrent refreshes with one token cannot both win.
   */
  consume(tokenHash: string, now: Date): Promise<Session | null>;
  /**
   * Grace replay: if this token was spent by a refresh no more than `windowMs` ago and its one
   * replay is still unused, marks the replay used (atomically) and returns the session. Otherwise null.
   */
  claimGrace(tokenHash: string, now: Date, windowMs: number): Promise<Session | null>;
  revokeByTokenHash(tokenHash: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}
