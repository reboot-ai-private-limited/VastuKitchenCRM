import mongoose, { Schema, type Model, type Types } from 'mongoose';

export interface LeadVisitDoc {
  leadId: Types.ObjectId;
  userId: Types.ObjectId;
  at: Date;
  latitude: number;
  longitude: number;
  note: string | null;
  photoUrl: string | null;
}

const schema = new Schema<LeadVisitDoc>(
  {
    leadId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    at: { type: Date, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    note: { type: String, default: null },
    photoUrl: { type: String, default: null },
  },
  { timestamps: true },
);

export const LeadVisitModel: Model<LeadVisitDoc> =
  (mongoose.models['LeadVisit'] as Model<LeadVisitDoc>) ??
  mongoose.model<LeadVisitDoc>('LeadVisit', schema);
