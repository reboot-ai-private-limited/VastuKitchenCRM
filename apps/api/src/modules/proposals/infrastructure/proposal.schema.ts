import mongoose, { Schema, type Model, type Types } from 'mongoose';
import { PROPOSAL_STATUSES, type ProposalTemplate } from '@vastu/contracts';

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
  /** Absent on proposals made before templates existed. */
  templateKey?: string | null;
  template?: ProposalTemplate | null;
  validUntil: Date | null;
  token: string;
  sentAt: Date | null;
  sentById: Types.ObjectId | null;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  seenCount: number;
  whatsappSends?: Array<{
    to: string;
    at: Date;
    byId: Types.ObjectId | null;
    messageId: string | null;
  }>;
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
    templateKey: { type: String, default: null },
    template: { type: Schema.Types.Mixed, default: null },
    validUntil: { type: Date, default: null },
    token: { type: String, required: true, unique: true },
    sentAt: { type: Date, default: null },
    sentById: { type: Schema.Types.ObjectId, default: null },
    firstSeenAt: { type: Date, default: null },
    lastSeenAt: { type: Date, default: null },
    seenCount: { type: Number, default: 0 },
    whatsappSends: {
      type: [
        new Schema(
          {
            to: { type: String, required: true },
            at: { type: Date, required: true },
            byId: { type: Schema.Types.ObjectId, default: null },
            messageId: { type: String, default: null },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    createdById: { type: Schema.Types.ObjectId, required: true, index: true },
  },
  { timestamps: true },
);
schema.index({ status: 1, sentAt: 1 });

export const ProposalModel: Model<ProposalDoc> =
  (mongoose.models['Proposal'] as Model<ProposalDoc>) ??
  mongoose.model<ProposalDoc>('Proposal', schema);
