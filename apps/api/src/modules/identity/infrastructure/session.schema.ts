import mongoose, { Schema, type Model, type Types } from 'mongoose';
import { CLIENT_KINDS } from '@vastu/contracts';

export interface SessionDoc {
  userId: Types.ObjectId;
  tokenHash: string;
  client: (typeof CLIENT_KINDS)[number];
  expiresAt: Date;
  revokedAt: Date | null;
}

const schema = new Schema<SessionDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    client: { type: String, enum: CLIENT_KINDS, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
// Expired rows are deleted by MongoDB itself (a week of grace keeps reuse-detection working).
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 86_400 });

export const SessionModel: Model<SessionDoc> =
  (mongoose.models['Session'] as Model<SessionDoc>) ??
  mongoose.model<SessionDoc>('Session', schema);
