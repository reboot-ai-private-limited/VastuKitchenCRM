import mongoose, { Schema, type Model, type Types } from 'mongoose';
import { LEAD_SOURCES, LEAD_STATUSES } from '@vastu/contracts';

export interface LeadDoc {
  name: string;
  phone: string;
  altPhone: string | null;
  email: string | null;
  city: string | null;
  notes: string | null;
  source: (typeof LEAD_SOURCES)[number];
  status: (typeof LEAD_STATUSES)[number];
  statusChangedAt: Date;
  assignedToId: Types.ObjectId | null;
  lostReason: string | null;
  customerId: Types.ObjectId | null;
  newProjectRequested: boolean;
  createdById: Types.ObjectId | null;
  createdAt: Date;
}

const schema = new Schema<LeadDoc>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true },
    altPhone: { type: String, default: null },
    email: { type: String, default: null },
    city: { type: String, default: null },
    notes: { type: String, default: null },
    source: { type: String, enum: LEAD_SOURCES, required: true },
    status: { type: String, enum: LEAD_STATUSES, required: true, default: 'NEW' },
    statusChangedAt: { type: Date, required: true },
    assignedToId: { type: Schema.Types.ObjectId, default: null },
    lostReason: { type: String, default: null },
    customerId: { type: Schema.Types.ObjectId, default: null },
    newProjectRequested: { type: Boolean, default: false },
    createdById: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true },
);
schema.index({ assignedToId: 1, status: 1 });
schema.index({ status: 1, statusChangedAt: 1 });
schema.index({ createdAt: -1 });
schema.index({ customerId: 1 });

export const LeadModel: Model<LeadDoc> =
  (mongoose.models['Lead'] as Model<LeadDoc>) ?? mongoose.model<LeadDoc>('Lead', schema);
