import mongoose, { Schema, type Model, type Types } from 'mongoose';
import { DEVICE_PLATFORMS } from '@vastu/contracts';

export interface DeviceDoc {
  userId: Types.ObjectId;
  token: string;
  platform: (typeof DEVICE_PLATFORMS)[number];
  appVersion: string | null;
  deviceName: string | null;
  lastSeenAt: Date;
  createdAt: Date;
}

const schema = new Schema<DeviceDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: DEVICE_PLATFORMS, required: true },
    appVersion: { type: String, default: null },
    deviceName: { type: String, default: null },
    lastSeenAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const DeviceModel: Model<DeviceDoc> =
  (mongoose.models['Device'] as Model<DeviceDoc>) ?? mongoose.model<DeviceDoc>('Device', schema);
