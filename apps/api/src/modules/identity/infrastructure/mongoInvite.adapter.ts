import type { HydratedDocument } from 'mongoose';
import type { CustomerInvite, NewCustomerInvite } from '../domain/invite.entity.js';
import type { InviteRepositoryPort } from '../domain/invite.repository.port.js';
import { CustomerInviteModel, type CustomerInviteDoc } from './customerInvite.schema.js';

const toEntity = (doc: HydratedDocument<CustomerInviteDoc>): CustomerInvite => ({
  id: doc.id as string,
  userId: doc.userId.toString(),
  tokenHash: doc.tokenHash,
  expiresAt: doc.expiresAt,
  usedAt: doc.usedAt,
});

export class MongoInviteRepository implements InviteRepositoryPort {
  async create(invite: NewCustomerInvite): Promise<CustomerInvite> {
    return toEntity(await CustomerInviteModel.create(invite));
  }

  async consume(tokenHash: string, now: Date): Promise<CustomerInvite | null> {
    const doc = await CustomerInviteModel.findOneAndUpdate(
      { tokenHash, usedAt: null, expiresAt: { $gt: now } },
      { $set: { usedAt: now } },
      { new: true },
    );
    return doc ? toEntity(doc) : null;
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await CustomerInviteModel.updateMany(
      { userId, usedAt: null },
      { $set: { usedAt: new Date() } },
    );
  }
}
