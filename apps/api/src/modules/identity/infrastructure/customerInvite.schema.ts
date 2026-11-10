import mongoose, { Schema, type Model, type Types } from 'mongoose';

export interface CustomerInviteDoc {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

const schema = new Schema<CustomerInviteDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 86_400 });

export const CustomerInviteModel: Model<CustomerInviteDoc> =
  (mongoose.models['CustomerInvite'] as Model<CustomerInviteDoc>) ??
  mongoose.model<CustomerInviteDoc>('CustomerInvite', schema);
