import mongoose, { Schema, type Model, type Types } from 'mongoose';

export interface ProjectCommentDoc {
  postId: Types.ObjectId;
  projectId: Types.ObjectId;
  authorId: Types.ObjectId;
  text: string | null;
  images: Array<{
    publicId: string;
    width: number | null;
    height: number | null;
    bytes: number | null;
  }>;
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

const schema = new Schema<ProjectCommentDoc>(
  {
    postId: { type: Schema.Types.ObjectId, required: true },
    projectId: { type: Schema.Types.ObjectId, required: true },
    authorId: { type: Schema.Types.ObjectId, required: true },
    text: { type: String, default: null },
    images: { type: [imageSchema], default: [] },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
schema.index({ postId: 1, createdAt: 1 });
schema.index({ authorId: 1, createdAt: -1 });

export const ProjectCommentModel: Model<ProjectCommentDoc> =
  (mongoose.models['ProjectComment'] as Model<ProjectCommentDoc>) ??
  mongoose.model<ProjectCommentDoc>('ProjectComment', schema);
