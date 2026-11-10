import mongoose, { Schema, type Model } from 'mongoose';
import { ATTENDANCE_TYPES, ROLE_NAMES } from '@vastu/contracts';

export interface UserDoc {
  name: string;
  phone: string;
  role: (typeof ROLE_NAMES)[number];
  designation: string | null;
  attendanceType: (typeof ATTENDANCE_TYPES)[number] | null;
  fixedSalary: number;
  passwordHash: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<UserDoc>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true },
    role: { type: String, enum: ROLE_NAMES, required: true, index: true },
    designation: { type: String, default: null },
    attendanceType: { type: String, enum: [...ATTENDANCE_TYPES, null], default: null },
    fixedSalary: { type: Number, default: 0, min: 0 },
    passwordHash: { type: String, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const UserModel: Model<UserDoc> =
  (mongoose.models['User'] as Model<UserDoc>) ?? mongoose.model<UserDoc>('User', schema);
