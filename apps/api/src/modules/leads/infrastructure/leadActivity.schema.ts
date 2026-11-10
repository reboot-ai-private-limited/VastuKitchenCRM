import mongoose, { Schema, type Model, type Types } from 'mongoose';
import { LEAD_ACTIVITY_TYPES } from '@vastu/contracts';

export interface LeadActivityDoc {
  leadId: Types.ObjectId;
  type: (typeof LEAD_ACTIVITY_TYPES)[number];
  byUserId: Types.ObjectId | null;
  at: Date;
  data: Record<string, unknown>;
}

const schema = new Schema<LeadActivityDoc>(
  {
    leadId: { type: Schema.Types.ObjectId, required: true },
    type: { type: String, enum: LEAD_ACTIVITY_TYPES, required: true },
    byUserId: { type: Schema.Types.ObjectId, default: null },
    at: { type: Date, required: true },
    data: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);
schema.index({ leadId: 1, at: -1 });

export const LeadActivityModel: Model<LeadActivityDoc> =
  (mongoose.models['LeadActivity'] as Model<LeadActivityDoc>) ??
  mongoose.model<LeadActivityDoc>('LeadActivity', schema);
