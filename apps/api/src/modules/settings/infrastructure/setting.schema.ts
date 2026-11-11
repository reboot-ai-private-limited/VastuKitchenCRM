import mongoose, { Schema, type Model, type Types } from 'mongoose';

export interface SettingDoc {
  key: string;
  value: unknown;
  updatedById: Types.ObjectId | null;
  updatedAt: Date;
}

const schema = new Schema<SettingDoc>(
  {
    key: { type: String, required: true, unique: true },
    // Boolean, number or string depending on the setting; the registry decides what is valid.
    value: { type: Schema.Types.Mixed, required: true },
    updatedById: { type: Schema.Types.ObjectId, default: null },
    updatedAt: { type: Date, required: true },
  },
  { timestamps: false },
);

export const SettingModel: Model<SettingDoc> =
  (mongoose.models['Setting'] as Model<SettingDoc>) ??
  mongoose.model<SettingDoc>('Setting', schema);
