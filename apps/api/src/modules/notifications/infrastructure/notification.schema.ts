import mongoose, { Schema, type Model, type Types } from 'mongoose';
import { NOTIFICATION_REF_KINDS, NOTIFICATION_TYPES } from '@vastu/contracts';

export interface NotificationDoc {
  userId: Types.ObjectId;
  type: (typeof NOTIFICATION_TYPES)[number];
  title: string;
  body: string;
  ref: { kind: (typeof NOTIFICATION_REF_KINDS)[number]; id: string; postId?: string } | null;
  dedupeKey: string | null;
  readAt: Date | null;
  createdAt: Date;
}

const schema = new Schema<NotificationDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    ref: {
      type: new Schema(
        {
          kind: { type: String, enum: NOTIFICATION_REF_KINDS, required: true },
          id: { type: String, required: true },
          postId: { type: String },
        },
        { _id: false },
      ),
      default: null,
    },
    dedupeKey: { type: String, default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

schema.index({ userId: 1, createdAt: -1 });
schema.index({ userId: 1, readAt: 1 });
// One delivery per (person, key). Only notifications that HAVE a key take part.
schema.index(
  { userId: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } },
);
// Old notifications clean themselves up after 30 days.
schema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 86_400 });

export const NotificationModel: Model<NotificationDoc> =
  (mongoose.models['Notification'] as Model<NotificationDoc>) ??
  mongoose.model<NotificationDoc>('Notification', schema);
