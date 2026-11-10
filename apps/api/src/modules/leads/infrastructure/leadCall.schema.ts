import mongoose, { Schema, type Model, type Types } from 'mongoose';
import { CALL_OUTCOMES } from '@vastu/contracts';

export interface LeadCallDoc {
  leadId: Types.ObjectId;
  userId: Types.ObjectId;
  startedAt: Date;
  durationSec: number;
  answered: boolean;
  outcome: (typeof CALL_OUTCOMES)[number] | null;
  note: string | null;
}

const schema = new Schema<LeadCallDoc>(
  {
    leadId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    startedAt: { type: Date, required: true },
    durationSec: { type: Number, required: true, min: 0 },
    answered: { type: Boolean, required: true },
    outcome: { type: String, enum: [...CALL_OUTCOMES, null], default: null },
    note: { type: String, default: null },
  },
  { timestamps: true },
);
// What makes uploads idempotent: the same call can only exist once.
schema.index({ leadId: 1, userId: 1, startedAt: 1 }, { unique: true });
schema.index({ userId: 1, startedAt: 1 });

export const LeadCallModel: Model<LeadCallDoc> =
  (mongoose.models['LeadCall'] as Model<LeadCallDoc>) ??
  mongoose.model<LeadCallDoc>('LeadCall', schema);
