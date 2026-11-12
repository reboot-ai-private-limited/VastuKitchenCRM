import mongoose, { Schema, type Model, type Types } from 'mongoose';

export interface OtpChallengeDoc {
  userId: Types.ObjectId;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  usedAt: Date | null;
}

const schema = new Schema<OtpChallengeDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
// Codes live minutes; Mongo clears the leftovers an hour after they expire.
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

export const OtpChallengeModel: Model<OtpChallengeDoc> =
  (mongoose.models['OtpChallenge'] as Model<OtpChallengeDoc>) ??
  mongoose.model<OtpChallengeDoc>('OtpChallenge', schema);
