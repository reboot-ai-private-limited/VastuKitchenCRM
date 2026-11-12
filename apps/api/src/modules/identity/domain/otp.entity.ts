export interface OtpChallenge {
  id: string;
  userId: string;
  codeHash: string;
  expiresAt: Date;
  /** Wrong guesses so far. */
  attempts: number;
  usedAt: Date | null;
  createdAt: Date;
}

export type NewOtpChallenge = Pick<OtpChallenge, 'userId' | 'codeHash' | 'expiresAt'>;
