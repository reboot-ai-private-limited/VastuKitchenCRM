import mongoose, { Schema, type Model, type Types } from 'mongoose';

export interface ProjectCommentDoc {
  postId: Types.ObjectId;
  projectId: Types.ObjectId;
  authorId: Types.ObjectId;
  text: string;
  deletedAt: Date | null;
  createdAt: Date;
}

const schema = new Schema<ProjectCommentDoc>(
  {
    postId: { type: Schema.Types.ObjectId, required: true },
    projectId: { type: Schema.Types.ObjectId, required: true },
    authorId: { type: Schema.Types.ObjectId, required: true },
    text: { type: String, required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
schema.index({ postId: 1, createdAt: 1 });

export const ProjectCommentModel: Model<ProjectCommentDoc> =
  (mongoose.models['ProjectComment'] as Model<ProjectCommentDoc>) ??
  mongoose.model<ProjectCommentDoc>('ProjectComment', schema);
