import type { HydratedDocument } from 'mongoose';
import type {
  LeadDesign,
  LeadDesignRepositoryPort,
  NewLeadDesign,
} from '../domain/design.entity.js';
import { LeadDesignModel, type LeadDesignDoc } from './leadDesign.schema.js';

const toEntity = (doc: HydratedDocument<LeadDesignDoc>): LeadDesign => ({
  id: doc.id as string,
  leadId: doc.leadId.toString(),
  userId: doc.userId.toString(),
  at: doc.at,
  note: doc.note,
  media: (doc.media ?? []).map((m) => ({
    kind: m.kind,
    publicId: m.publicId,
    fileName: m.fileName ?? null,
    width: m.width ?? null,
    height: m.height ?? null,
    bytes: m.bytes ?? null,
    durationSec: m.durationSec ?? null,
    resourceType: m.resourceType ?? null,
    format: m.format ?? null,
  })),
});

export class MongoLeadDesignRepository implements LeadDesignRepositoryPort {
  async create(design: NewLeadDesign): Promise<LeadDesign> {
    return toEntity(await LeadDesignModel.create(design));
  }

  async listByLead(leadId: string): Promise<LeadDesign[]> {
    return (await LeadDesignModel.find({ leadId }).sort({ at: -1 })).map(toEntity);
  }
}
