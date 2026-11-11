import mongoose, { Schema, type Model, type Types } from 'mongoose';
import { DESIGN_STAGES, PROJECT_STAGES } from '@vastu/contracts';

export interface ProjectDoc {
  name: string;
  customerId: Types.ObjectId;
  leadId: Types.ObjectId | null;
  wonLeadId: Types.ObjectId | null;
  siteAddress: string | null;
  value: number | null;
  stage: (typeof PROJECT_STAGES)[number];
  designStage: (typeof DESIGN_STAGES)[number];
  designerId: Types.ObjectId | null;
  memberIds: Types.ObjectId[];
  createdById: Types.ObjectId | null;
  closedAt: Date | null;
  createdAt: Date;
}

const schema = new Schema<ProjectDoc>(
  {
    name: { type: String, required: true, trim: true },
    customerId: { type: Schema.Types.ObjectId, required: true, index: true },
    leadId: { type: Schema.Types.ObjectId, default: null, index: true },
    wonLeadId: { type: Schema.Types.ObjectId, default: null },
    siteAddress: { type: String, default: null },
    value: { type: Number, default: null, min: 0 },
    stage: { type: String, enum: PROJECT_STAGES, required: true, default: 'DESIGN' },
    designStage: { type: String, enum: DESIGN_STAGES, required: true, default: 'NOT_STARTED' },
    designerId: { type: Schema.Types.ObjectId, default: null, index: true },
    memberIds: { type: [Schema.Types.ObjectId], default: [], index: true },
    createdById: { type: Schema.Types.ObjectId, default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
// One auto-created project per won lead — this is what makes the creation idempotent. Manual
// projects leave it null, so a customer (or a lead) can have any number of them.
schema.index(
  { wonLeadId: 1 },
  { unique: true, partialFilterExpression: { wonLeadId: { $type: 'objectId' } } },
);
schema.index({ stage: 1, createdAt: -1 });

export const ProjectModel: Model<ProjectDoc> =
  (mongoose.models['Project'] as Model<ProjectDoc>) ??
  mongoose.model<ProjectDoc>('Project', schema);
