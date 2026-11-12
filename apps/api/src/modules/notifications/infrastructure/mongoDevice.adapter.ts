import { isValidObjectId, type HydratedDocument } from 'mongoose';
import type { Device, DeviceInput } from '../domain/device.entity.js';
import type { DeviceRepositoryPort } from '../domain/device.repository.port.js';
import { DeviceModel, type DeviceDoc } from './device.schema.js';

const toEntity = (doc: HydratedDocument<DeviceDoc>): Device => ({
  id: doc.id as string,
  userId: doc.userId.toString(),
  token: doc.token,
  platform: doc.platform,
  appVersion: doc.appVersion,
  deviceName: doc.deviceName,
  lastSeenAt: doc.lastSeenAt,
  createdAt: doc.createdAt,
});

export class MongoDeviceRepository implements DeviceRepositoryPort {
  async register(userId: string, input: DeviceInput, now: Date, maxDevices: number) {
    const doc = await DeviceModel.findOneAndUpdate(
      { token: input.token },
      {
        $set: {
          userId,
          platform: input.platform,
          appVersion: input.appVersion,
          deviceName: input.deviceName,
          lastSeenAt: now,
        },
        $setOnInsert: { token: input.token },
      },
      { upsert: true, new: true },
    );
    const mine = await DeviceModel.find({ userId }).sort({ lastSeenAt: -1, _id: -1 }).select('_id');
    const evict = mine.slice(maxDevices).map((d) => d._id);
    if (evict.length > 0) await DeviceModel.deleteMany({ _id: { $in: evict } });
    return toEntity(doc);
  }

  async remove(userId: string, id: string) {
    if (!isValidObjectId(userId) || !isValidObjectId(id)) return false;
    return (await DeviceModel.deleteOne({ _id: id, userId })).deletedCount === 1;
  }

  async tokensFor(userId: string) {
    if (!isValidObjectId(userId)) return [];
    return (await DeviceModel.find({ userId }).select('token')).map((d) => d.token);
  }

  async removeTokens(tokens: string[]) {
    if (tokens.length > 0) await DeviceModel.deleteMany({ token: { $in: tokens } });
  }
}
