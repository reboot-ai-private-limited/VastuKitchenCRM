import mongoose, { Schema, type Model, type Types } from 'mongoose';
import { POST_KINDS, POST_VISIBILITIES } from '@vastu/contracts';

export interface ProjectPostDoc {
  projectId: Types.ObjectId;
  authorId: Types.ObjectId;
  visibility: (typeof POST_VISIBILITIES)[number];
  kind: (typeof POST_KINDS)[number];
  text: string | null;
  images: Array<{
    publicId: string;
    width: number | null;
    height: number | null;
    bytes: number | null;
  }>;
  approvedById: Types.ObjectId | null;
  approvedAt: Date | null;
  commentCount: number;
  deletedAt: Date | null;
  createdAt: Date;
}

const imageSchema = new Schema(
  {
    publicId: { type: String, required: true },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    bytes: { type: Number, default: null },
  },
  { _id: false },
);

const schema = new Schema<ProjectPostDoc>(
  {
    projectId: { type: Schema.Types.ObjectId, required: true },
    authorId: { type: Schema.Types.ObjectId, required: true },
    visibility: { type: String, enum: POST_VISIBILITIES, required: true },
    kind: { type: String, enum: POST_KINDS, required: true, default: 'UPDATE' },
    text: { type: String, default: null },
    images: { type: [imageSchema], default: [] },
    approvedById: { type: Schema.Types.ObjectId, default: null },
    approvedAt: { type: Date, default: null },
    commentCount: { type: Number, default: 0, min: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
// The feed query: one project, some tabs, newest first.
schema.index({ projectId: 1, visibility: 1, createdAt: -1 });
schema.index({ projectId: 1, kind: 1 });

export const ProjectPostModel: Model<ProjectPostDoc> =
  (mongoose.models['ProjectPost'] as Model<ProjectPostDoc>) ??
  mongoose.model<ProjectPostDoc>('ProjectPost', schema);
