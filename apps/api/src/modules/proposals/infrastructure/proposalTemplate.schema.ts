import mongoose, { Schema, type Model, type Types } from 'mongoose';
import type { ProposalTemplate } from '@vastu/contracts';

export interface ProposalTemplateDoc {
  /** `tpl_<objectid>`: generated here, never chosen by the caller. */
  key: string;
  name: string;
  /** The whole template (including `key`), validated by the API before it is stored. */
  template: ProposalTemplate;
  createdById: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ProposalTemplateDoc>(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    template: { type: Schema.Types.Mixed, required: true },
    createdById: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true },
);

export const ProposalTemplateModel: Model<ProposalTemplateDoc> =
  (mongoose.models['ProposalTemplate'] as Model<ProposalTemplateDoc>) ??
  mongoose.model<ProposalTemplateDoc>('ProposalTemplate', schema);
