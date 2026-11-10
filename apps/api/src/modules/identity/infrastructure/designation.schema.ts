import mongoose, { Schema, type Model } from 'mongoose';

export interface DesignationDoc {
  name: string;
  /** Lower-cased name; the unique key, so "receptionist" and "Receptionist" cannot both exist. */
  nameKey: string;
  active: boolean;
}

const schema = new Schema<DesignationDoc>(
  {
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true, unique: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const DesignationModel: Model<DesignationDoc> =
  (mongoose.models['Designation'] as Model<DesignationDoc>) ??
  mongoose.model<DesignationDoc>('Designation', schema);
