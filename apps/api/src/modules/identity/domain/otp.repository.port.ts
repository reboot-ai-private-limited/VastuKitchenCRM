import type { NewOtpChallenge, OtpChallenge } from './otp.entity.js';

export interface OtpRepositoryPort {
  /** Stores a fresh code and voids every earlier unused one of that user. */
  replaceForUser(challenge: NewOtpChallenge): Promise<OtpChallenge>;
  /** The newest code of this user, used or not (for the resend cooldown). */
  latestForUser(userId: string): Promise<OtpChallenge | null>;
  /** The live code: unused and not expired. */
  findLive(userId: string, now: Date): Promise<OtpChallenge | null>;
  /** Counts one wrong guess and returns the new total. */
  recordFailure(id: string): Promise<number>;
  /** Marks the code used if it still is live, atomically. False when someone else got there first. */
  consume(id: string, now: Date): Promise<boolean>;
}
