import mongoose, { Schema, type Model, type Types } from 'mongoose';

export interface DeletionRequestDoc {
  userId: Types.ObjectId;
  name: string;
  phone: string;
  role: string;
  reason: string | null;
  requestedAt: Date;
  completedAt: Date | null;
}

const schema = new Schema<DeletionRequestDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    role: { type: String, required: true },
    reason: { type: String, default: null },
    requestedAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const DeletionRequestModel: Model<DeletionRequestDoc> =
  (mongoose.models['DeletionRequest'] as Model<DeletionRequestDoc>) ??
  mongoose.model<DeletionRequestDoc>('DeletionRequest', schema);
