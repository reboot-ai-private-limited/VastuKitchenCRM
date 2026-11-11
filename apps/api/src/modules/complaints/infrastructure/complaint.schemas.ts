import mongoose, { Schema, type Model, type Types } from 'mongoose';
import { COMPLAINT_EVENT_TYPES, COMPLAINT_STATUSES } from '@vastu/contracts';

interface ImageRefDoc {
  publicId: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
}
const imageSchema = new Schema<ImageRefDoc>(
  {
    publicId: { type: String, required: true },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    bytes: { type: Number, default: null },
  },
  { _id: false },
);

export interface ComplaintEventDoc {
  type: (typeof COMPLAINT_EVENT_TYPES)[number];
  at: Date;
  actorId: Types.ObjectId | null;
  note: string | null;
  assigneeId: Types.ObjectId | null;
}
const eventSchema = new Schema<ComplaintEventDoc>(
  {
    type: { type: String, enum: COMPLAINT_EVENT_TYPES, required: true },
    at: { type: Date, required: true },
    actorId: { type: Schema.Types.ObjectId, default: null },
    note: { type: String, default: null },
    assigneeId: { type: Schema.Types.ObjectId, default: null },
  },
  { _id: false },
);

export interface ComplaintDoc {
  projectId: Types.ObjectId;
  customerId: Types.ObjectId;
  description: string;
  images: ImageRefDoc[];
  status: (typeof COMPLAINT_STATUSES)[number];
  raisedById: Types.ObjectId | null;
  assignedToId: Types.ObjectId | null;
  resolutionNote: string | null;
  resolutionImages: ImageRefDoc[];
  activeSince: Date;
  assignedAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  reopenCount: number;
  events: ComplaintEventDoc[];
  createdAt: Date;
}

const complaintSchema = new Schema<ComplaintDoc>(
  {
    projectId: { type: Schema.Types.ObjectId, required: true },
    customerId: { type: Schema.Types.ObjectId, required: true },
    description: { type: String, required: true },
    images: { type: [imageSchema], default: [] },
    status: { type: String, enum: COMPLAINT_STATUSES, required: true, default: 'OPEN' },
    raisedById: { type: Schema.Types.ObjectId, default: null },
    assignedToId: { type: Schema.Types.ObjectId, default: null },
    resolutionNote: { type: String, default: null },
    resolutionImages: { type: [imageSchema], default: [] },
    activeSince: { type: Date, required: true },
    assignedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    reopenCount: { type: Number, default: 0 },
    events: { type: [eventSchema], default: [] },
  },
  { timestamps: true },
);
complaintSchema.index({ status: 1, createdAt: -1 });
complaintSchema.index({ projectId: 1, createdAt: -1 });
complaintSchema.index({ assignedToId: 1, status: 1 });
complaintSchema.index({ customerId: 1 });
complaintSchema.index({ raisedById: 1 });
// The reminder scan: only unresolved complaints, oldest activity first.
complaintSchema.index({ status: 1, activeSince: 1 });

export const ComplaintModel: Model<ComplaintDoc> =
  (mongoose.models['Complaint'] as Model<ComplaintDoc>) ??
  mongoose.model<ComplaintDoc>('Complaint', complaintSchema);
