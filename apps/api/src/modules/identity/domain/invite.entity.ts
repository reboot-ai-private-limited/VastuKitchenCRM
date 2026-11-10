/** A one-time customer sign-in link. Holds only the HASH of its token. */
export interface CustomerInvite {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export type NewCustomerInvite = Omit<CustomerInvite, 'id' | 'usedAt'>;
