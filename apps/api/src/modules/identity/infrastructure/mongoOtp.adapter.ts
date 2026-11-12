import type { HydratedDocument } from 'mongoose';
import type { NewOtpChallenge, OtpChallenge } from '../domain/otp.entity.js';
import type { OtpRepositoryPort } from '../domain/otp.repository.port.js';
import { OtpChallengeModel, type OtpChallengeDoc } from './otp.schema.js';

const toEntity = (doc: HydratedDocument<OtpChallengeDoc> & { createdAt?: Date }): OtpChallenge => ({
  id: doc.id as string,
  userId: doc.userId.toString(),
  codeHash: doc.codeHash,
  expiresAt: doc.expiresAt,
  attempts: doc.attempts,
  usedAt: doc.usedAt,
  createdAt: doc.createdAt ?? new Date(),
});

export class MongoOtpRepository implements OtpRepositoryPort {
  async replaceForUser(challenge: NewOtpChallenge): Promise<OtpChallenge> {
    await OtpChallengeModel.updateMany(
      { userId: challenge.userId, usedAt: null },
      { $set: { usedAt: new Date() } },
    );
    return toEntity(await OtpChallengeModel.create(challenge));
  }

  async latestForUser(userId: string): Promise<OtpChallenge | null> {
    const doc = await OtpChallengeModel.findOne({ userId }).sort({ createdAt: -1 });
    return doc ? toEntity(doc) : null;
  }

  async findLive(userId: string, now: Date): Promise<OtpChallenge | null> {
    const doc = await OtpChallengeModel.findOne({
      userId,
      usedAt: null,
      expiresAt: { $gt: now },
    }).sort({ createdAt: -1 });
    return doc ? toEntity(doc) : null;
  }

  async recordFailure(id: string): Promise<number> {
    const doc = await OtpChallengeModel.findByIdAndUpdate(
      id,
      { $inc: { attempts: 1 } },
      { new: true },
    );
    return doc?.attempts ?? Number.MAX_SAFE_INTEGER;
  }

  async consume(id: string, now: Date): Promise<boolean> {
    const doc = await OtpChallengeModel.findOneAndUpdate(
      { _id: id, usedAt: null, expiresAt: { $gt: now } },
      { $set: { usedAt: now } },
    );
    return doc !== null;
  }
}
