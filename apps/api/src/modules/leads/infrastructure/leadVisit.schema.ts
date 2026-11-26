import mongoose, { Schema, type Model, type Types } from 'mongoose';
import { VISIT_MEDIA_KINDS } from '@vastu/contracts';

export interface LeadVisitMediaDoc {
  kind: (typeof VISIT_MEDIA_KINDS)[number];
  publicId: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  durationSec: number | null;
}

export interface LeadVisitDoc {
  leadId: Types.ObjectId;
  userId: Types.ObjectId;
  at: Date;
  latitude: number | null;
  longitude: number | null;
  note: string | null;
  photoUrl: string | null;
  media: LeadVisitMediaDoc[];
}

const mediaSchema = new Schema<LeadVisitMediaDoc>(
  {
    kind: { type: String, enum: VISIT_MEDIA_KINDS, required: true },
    publicId: { type: String, required: true },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    bytes: { type: Number, default: null },
    durationSec: { type: Number, default: null },
  },
  { _id: false },
);

const schema = new Schema<LeadVisitDoc>(
  {
    leadId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    at: { type: Date, required: true },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    note: { type: String, default: null },
    photoUrl: { type: String, default: null },
    media: { type: [mediaSchema], default: [] },
  },
  { timestamps: true },
);

export const LeadVisitModel: Model<LeadVisitDoc> =
  (mongoose.models['LeadVisit'] as Model<LeadVisitDoc>) ??
  mongoose.model<LeadVisitDoc>('LeadVisit', schema);
