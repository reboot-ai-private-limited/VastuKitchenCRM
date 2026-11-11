import { Types, isValidObjectId } from 'mongoose';
import type { SettingKey } from '@vastu/contracts';
import type { StoredSetting } from '../domain/setting.entity.js';
import type { SettingRepositoryPort } from '../domain/setting.repository.port.js';
import { SettingModel } from './setting.schema.js';

export class MongoSettingRepository implements SettingRepositoryPort {
  async findAll(): Promise<StoredSetting[]> {
    const docs = await SettingModel.find({});
    return docs.map((d) => ({
      key: d.key as SettingKey,
      value: d.value as StoredSetting['value'],
      updatedById: d.updatedById ? d.updatedById.toString() : null,
      updatedAt: d.updatedAt,
    }));
  }

  async setMany(
    entries: Array<{ key: SettingKey; value: boolean | number | string }>,
    updatedById: string,
    at: Date,
  ): Promise<void> {
    const by = isValidObjectId(updatedById) ? new Types.ObjectId(updatedById) : null;
    await SettingModel.bulkWrite(
      entries.map((e) => ({
        updateOne: {
          filter: { key: e.key },
          update: { $set: { value: e.value, updatedById: by, updatedAt: at } },
          upsert: true,
        },
      })),
    );
  }

  async remove(key: SettingKey): Promise<boolean> {
    return (await SettingModel.deleteOne({ key })).deletedCount === 1;
  }
}
