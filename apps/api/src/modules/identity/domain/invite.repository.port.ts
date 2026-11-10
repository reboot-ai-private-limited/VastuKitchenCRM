import type { CustomerInvite, NewCustomerInvite } from './invite.entity.js';

export interface InviteRepositoryPort {
  create(invite: NewCustomerInvite): Promise<CustomerInvite>;
  /** Marks the invite used if it is live, atomically. Null when unknown, used or expired. */
  consume(tokenHash: string, now: Date): Promise<CustomerInvite | null>;
  /** Voids every unused invite of a customer (a new invite replaces the old one). */
  revokeAllForUser(userId: string): Promise<void>;
}
