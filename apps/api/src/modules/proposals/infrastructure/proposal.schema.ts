import mongoose, { Schema, type Model, type Types } from 'mongoose';
import { PROPOSAL_STATUSES } from '@vastu/contracts';

export interface ProposalDoc {
  number: string;
  leadId: Types.ObjectId;
  status: (typeof PROPOSAL_STATUSES)[number];
  customer: { name: string; phone: string; city: string | null; siteAddress: string | null };
  title: string;
  items: Array<{
    title: string;
    description: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  subtotal: number;
  discount: number;
  total: number;
  notes: string | null;
  terms: string;
  validUntil: Date | null;
  token: string;
  sentAt: Date | null;
  sentById: Types.ObjectId | null;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  seenCount: number;
  createdById: Types.ObjectId;
  createdAt: Date;
}

const itemSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: null },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    lineTotal: { type: Number, required: true },
  },
  { _id: false },
);

const schema = new Schema<ProposalDoc>(
  {
    number: { type: String, required: true, unique: true },
    leadId: { type: Schema.Types.ObjectId, required: true, index: true },
    status: { type: String, enum: PROPOSAL_STATUSES, required: true, default: 'DRAFT' },
    customer: {
      type: new Schema(
        {
          name: { type: String, required: true },
          phone: { type: String, required: true },
          city: { type: String, default: null },
          siteAddress: { type: String, default: null },
        },
        { _id: false },
      ),
      required: true,
    },
    title: { type: String, required: true },
    items: { type: [itemSchema], required: true },
    subtotal: { type: Number, required: true },
    discount: { type: Number, required: true },
    total: { type: Number, required: true },
    notes: { type: String, default: null },
    terms: { type: String, required: true },
    validUntil: { type: Date, default: null },
    token: { type: String, required: true, unique: true },
    sentAt: { type: Date, default: null },
    sentById: { type: Schema.Types.ObjectId, default: null },
    firstSeenAt: { type: Date, default: null },
    lastSeenAt: { type: Date, default: null },
    seenCount: { type: Number, default: 0 },
    createdById: { type: Schema.Types.ObjectId, required: true, index: true },
  },
  { timestamps: true },
);
schema.index({ status: 1, sentAt: 1 });

export const ProposalModel: Model<ProposalDoc> =
  (mongoose.models['Proposal'] as Model<ProposalDoc>) ??
  mongoose.model<ProposalDoc>('Proposal', schema);
