import mongoose, { Schema, type Model, type Types } from 'mongoose';
import { PROJECT_ACTIVITY_TYPES } from '@vastu/contracts';

export interface ProjectActivityDoc {
  projectId: Types.ObjectId;
  type: (typeof PROJECT_ACTIVITY_TYPES)[number];
  actorId: Types.ObjectId | null;
  at: Date;
  data: Record<string, unknown>;
}

const schema = new Schema<ProjectActivityDoc>(
  {
    projectId: { type: Schema.Types.ObjectId, required: true },
    type: { type: String, enum: PROJECT_ACTIVITY_TYPES, required: true },
    actorId: { type: Schema.Types.ObjectId, default: null },
    at: { type: Date, required: true },
    data: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: false },
);
schema.index({ projectId: 1, at: -1 });

export const ProjectActivityModel: Model<ProjectActivityDoc> =
  (mongoose.models['ProjectActivity'] as Model<ProjectActivityDoc>) ??
  mongoose.model<ProjectActivityDoc>('ProjectActivity', schema);
