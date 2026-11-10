import type { HydratedDocument } from 'mongoose';
import type { NewVisit, Visit } from '../domain/visit.entity.js';
import type { VisitRepositoryPort } from '../domain/visit.repository.port.js';
import { LeadVisitModel, type LeadVisitDoc } from './leadVisit.schema.js';

const toEntity = (doc: HydratedDocument<LeadVisitDoc>): Visit => ({
  id: doc.id as string,
  leadId: doc.leadId.toString(),
  userId: doc.userId.toString(),
  at: doc.at,
  latitude: doc.latitude,
  longitude: doc.longitude,
  note: doc.note,
  photoUrl: doc.photoUrl,
});

export class MongoVisitRepository implements VisitRepositoryPort {
  async create(visit: NewVisit): Promise<Visit> {
    return toEntity(await LeadVisitModel.create(visit));
  }

  async listByLead(leadId: string): Promise<Visit[]> {
    return (await LeadVisitModel.find({ leadId }).sort({ at: -1 })).map(toEntity);
  }
}
