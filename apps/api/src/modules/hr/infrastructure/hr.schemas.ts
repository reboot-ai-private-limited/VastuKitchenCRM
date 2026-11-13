import mongoose, { Schema, type Model, type Types } from 'mongoose';
import { ATTENDANCE_METHODS } from '@vastu/contracts';

interface LocationDoc {
  lat: number;
  lng: number;
  accuracy?: number;
}
const locationSchema = new Schema<LocationDoc>(
  { lat: Number, lng: Number, accuracy: Number },
  { _id: false },
);

export interface AttendanceDoc {
  userId: Types.ObjectId;
  date: string;
  inAt: Date;
  outAt: Date | null;
  method: (typeof ATTENDANCE_METHODS)[number];
  inLocation: LocationDoc | null;
  outLocation: LocationDoc | null;
  correctedById: Types.ObjectId | null;
  correctedAt: Date | null;
  note: string | null;
}

const attendanceSchema = new Schema<AttendanceDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    date: { type: String, required: true },
    inAt: { type: Date, required: true },
    outAt: { type: Date, default: null },
    method: { type: String, enum: ATTENDANCE_METHODS, required: true },
    inLocation: { type: locationSchema, default: null },
    outLocation: { type: locationSchema, default: null },
    correctedById: { type: Schema.Types.ObjectId, default: null },
    correctedAt: { type: Date, default: null },
    note: { type: String, default: null },
  },
  { timestamps: true },
);
// One record per person per day. This is what makes a double-tapped check-in harmless.
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1 });

export const AttendanceModel: Model<AttendanceDoc> =
  (mongoose.models['Attendance'] as Model<AttendanceDoc>) ??
  mongoose.model<AttendanceDoc>('Attendance', attendanceSchema);

export interface SalaryDoc {
  month: string;
  userId: Types.ObjectId;
  name: string;
  designation: string | null;
  fixedSalary: number;
  presentDays: number;
  workingDays: number;
  computedPayable: number;
  payable: number;
  editedById: Types.ObjectId | null;
  editedAt: Date | null;
  note: string | null;
  weeklyOff: string;
  finalizedAt: Date | null;
  finalizedById: Types.ObjectId | null;
}

const salarySchema = new Schema<SalaryDoc>(
  {
    month: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    designation: { type: String, default: null },
    fixedSalary: { type: Number, required: true },
    presentDays: { type: Number, required: true },
    workingDays: { type: Number, required: true },
    computedPayable: { type: Number, required: true },
    payable: { type: Number, required: true },
    editedById: { type: Schema.Types.ObjectId, default: null },
    editedAt: { type: Date, default: null },
    note: { type: String, default: null },
    weeklyOff: { type: String, required: true },
    finalizedAt: { type: Date, default: null },
    finalizedById: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true },
);
salarySchema.index({ month: 1, userId: 1 }, { unique: true });

export const SalaryModel: Model<SalaryDoc> =
  (mongoose.models['SalaryRow'] as Model<SalaryDoc>) ??
  mongoose.model<SalaryDoc>('SalaryRow', salarySchema);

export interface SalesTargetDoc {
  month: string;
  userId: Types.ObjectId;
  amount: number;
  setById: Types.ObjectId;
  setAt: Date;
}

const salesTargetSchema = new Schema<SalesTargetDoc>(
  {
    month: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    amount: { type: Number, required: true },
    setById: { type: Schema.Types.ObjectId, required: true },
    setAt: { type: Date, required: true },
  },
  { timestamps: true },
);
salesTargetSchema.index({ month: 1, userId: 1 }, { unique: true });

export const SalesTargetModel: Model<SalesTargetDoc> =
  (mongoose.models['SalesTarget'] as Model<SalesTargetDoc>) ??
  mongoose.model<SalesTargetDoc>('SalesTarget', salesTargetSchema);
