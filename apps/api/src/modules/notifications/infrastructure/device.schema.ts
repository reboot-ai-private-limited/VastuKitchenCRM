import mongoose, { Schema, type Model, type Types } from 'mongoose';
import { DEVICE_PLATFORMS, PUSH_PROVIDERS } from '@vastu/contracts';

export interface DeviceDoc {
  userId: Types.ObjectId;
  platform: (typeof DEVICE_PLATFORMS)[number];
  provider: (typeof PUSH_PROVIDERS)[number];
  token: string;
  appVersion: string | null;
  deviceName: string | null;
  locale: string | null;
  lastSeenAt: Date;
  createdAt: Date;
}

const schema = new Schema<DeviceDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    platform: { type: String, enum: DEVICE_PLATFORMS, required: true },
    provider: { type: String, enum: PUSH_PROVIDERS, required: true },
    token: { type: String, required: true, unique: true },
    appVersion: { type: String, default: null },
    deviceName: { type: String, default: null },
    locale: { type: String, default: null },
    lastSeenAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
// A phone that stops opening the app for 120 days is forgotten.
schema.index({ lastSeenAt: 1 }, { expireAfterSeconds: 120 * 86_400 });

export const DeviceModel: Model<DeviceDoc> =
  (mongoose.models['Device'] as Model<DeviceDoc>) ?? mongoose.model<DeviceDoc>('Device', schema);
