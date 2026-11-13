import { isValidObjectId, type HydratedDocument } from 'mongoose';
import type { Device, UpsertDevice } from '../domain/device.entity.js';
import type { DeviceRepositoryPort } from '../domain/device.repository.port.js';
import { DeviceModel, type DeviceDoc } from './device.schema.js';

const toEntity = (doc: HydratedDocument<DeviceDoc>): Device => ({
  id: doc.id as string,
  userId: doc.userId.toString(),
  platform: doc.platform,
  provider: doc.provider,
  token: doc.token,
  appVersion: doc.appVersion,
  deviceName: doc.deviceName,
  locale: doc.locale,
  lastSeenAt: doc.lastSeenAt,
  createdAt: doc.createdAt,
});

export class MongoDeviceRepository implements DeviceRepositoryPort {
  async upsertByToken(device: UpsertDevice): Promise<Device> {
    const doc = await DeviceModel.findOneAndUpdate({ token: device.token }, device, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
    return toEntity(doc);
  }

  async removeOwn(userId: string, id: string): Promise<boolean> {
    if (!isValidObjectId(userId) || !isValidObjectId(id)) return false;
    const res = await DeviceModel.deleteOne({ _id: id, userId });
    return res.deletedCount === 1;
  }

  async listFcmTokens(userId: string): Promise<string[]> {
    if (!isValidObjectId(userId)) return [];
    const docs = await DeviceModel.find({ userId, provider: 'fcm' }, { token: 1 });
    return docs.map((d) => d.token);
  }

  async removeTokens(tokens: string[]): Promise<void> {
    if (tokens.length > 0) await DeviceModel.deleteMany({ token: { $in: tokens } });
  }

  async removeAllForUser(userId: string): Promise<number> {
    if (!isValidObjectId(userId)) return 0;
    return (await DeviceModel.deleteMany({ userId })).deletedCount;
  }
}
