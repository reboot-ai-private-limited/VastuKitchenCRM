import type { HydratedDocument } from 'mongoose';
import type { NewSession, Session } from '../domain/session.entity.js';
import type { SessionRepositoryPort } from '../domain/session.repository.port.js';
import { SessionModel, type SessionDoc } from './session.schema.js';

const toEntity = (doc: HydratedDocument<SessionDoc>): Session => ({
  id: doc.id as string,
  userId: doc.userId.toString(),
  tokenHash: doc.tokenHash,
  client: doc.client,
  expiresAt: doc.expiresAt,
  revokedAt: doc.revokedAt,
  rotatedAt: doc.rotatedAt ?? null,
  graceUsedAt: doc.graceUsedAt ?? null,
});

export class MongoSessionRepository implements SessionRepositoryPort {
  async create(session: NewSession): Promise<Session> {
    return toEntity(await SessionModel.create(session));
  }

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const doc = await SessionModel.findOne({ tokenHash });
    return doc ? toEntity(doc) : null;
  }

  async consume(tokenHash: string, now: Date): Promise<Session | null> {
    const doc = await SessionModel.findOneAndUpdate(
      { tokenHash, revokedAt: null, expiresAt: { $gt: now } },
      { $set: { revokedAt: now, rotatedAt: now } },
      { new: true },
    );
    return doc ? toEntity(doc) : null;
  }

  async claimGrace(tokenHash: string, now: Date, windowMs: number): Promise<Session | null> {
    const doc = await SessionModel.findOneAndUpdate(
      {
        tokenHash,
        rotatedAt: { $gte: new Date(now.getTime() - windowMs) },
        graceUsedAt: null,
        expiresAt: { $gt: now },
      },
      { $set: { graceUsedAt: now } },
      { new: true },
    );
    return doc ? toEntity(doc) : null;
  }

  async revokeByTokenHash(tokenHash: string): Promise<void> {
    await SessionModel.updateOne(
      { tokenHash, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await SessionModel.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
  }
}
