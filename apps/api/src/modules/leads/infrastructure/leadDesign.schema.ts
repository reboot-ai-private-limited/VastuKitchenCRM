import mongoose, { Schema, type Model, type Types } from 'mongoose';
import { DESIGN_MEDIA_KINDS } from '@vastu/contracts';

export interface LeadDesignMediaDoc {
  kind: (typeof DESIGN_MEDIA_KINDS)[number];
  publicId: string;
  fileName: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  durationSec: number | null;
  resourceType: 'image' | 'video' | 'raw' | null;
  format: string | null;
}

export interface LeadDesignDoc {
  leadId: Types.ObjectId;
  userId: Types.ObjectId;
  at: Date;
  note: string | null;
  media: LeadDesignMediaDoc[];
}

const mediaSchema = new Schema<LeadDesignMediaDoc>(
  {
    kind: { type: String, enum: DESIGN_MEDIA_KINDS, required: true },
    publicId: { type: String, required: true },
    fileName: { type: String, default: null },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    bytes: { type: Number, default: null },
    durationSec: { type: Number, default: null },
    resourceType: { type: String, enum: ['image', 'video', 'raw'], default: null },
    format: { type: String, default: null },
  },
  { _id: false },
);

const schema = new Schema<LeadDesignDoc>(
  {
    leadId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    at: { type: Date, required: true },
    note: { type: String, default: null },
    media: { type: [mediaSchema], default: [] },
  },
  { timestamps: true },
);

export const LeadDesignModel: Model<LeadDesignDoc> =
  (mongoose.models['LeadDesign'] as Model<LeadDesignDoc>) ??
  mongoose.model<LeadDesignDoc>('LeadDesign', schema);
