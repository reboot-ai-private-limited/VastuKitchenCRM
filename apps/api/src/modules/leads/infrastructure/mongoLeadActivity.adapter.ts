import type { HydratedDocument } from 'mongoose';
import type { LeadActivity, NewLeadActivity } from '../domain/leadActivity.entity.js';
import type { LeadActivityRepositoryPort } from '../domain/leadActivity.repository.port.js';
import { LeadActivityModel, type LeadActivityDoc } from './leadActivity.schema.js';

const toEntity = (doc: HydratedDocument<LeadActivityDoc>): LeadActivity => ({
  id: doc.id as string,
  leadId: doc.leadId.toString(),
  type: doc.type,
  byUserId: doc.byUserId ? doc.byUserId.toString() : null,
  at: doc.at,
  data: doc.data,
});

export class MongoLeadActivityRepository implements LeadActivityRepositoryPort {
  async add(activity: NewLeadActivity): Promise<void> {
    await LeadActivityModel.create(activity);
  }

  async listByLead(leadId: string): Promise<LeadActivity[]> {
    return (await LeadActivityModel.find({ leadId }).sort({ at: -1, _id: -1 })).map(toEntity);
  }
}
