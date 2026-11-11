import mongoose, { Schema, type Model, type Types } from 'mongoose';
import { POST_VISIBILITIES } from '@vastu/contracts';

export interface DocFolderDoc {
  projectId: Types.ObjectId;
  parentId: Types.ObjectId | null;
  name: string;
  /** Lower-cased name: siblings cannot share one, whatever the capitalisation. */
  nameKey: string;
  createdById: Types.ObjectId;
  createdAt: Date;
}

const folderSchema = new Schema<DocFolderDoc>(
  {
    projectId: { type: Schema.Types.ObjectId, required: true },
    parentId: { type: Schema.Types.ObjectId, default: null },
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true },
    createdById: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true },
);
folderSchema.index({ projectId: 1, parentId: 1, nameKey: 1 }, { unique: true });

export const DocFolderModel: Model<DocFolderDoc> =
  (mongoose.models['DocFolder'] as Model<DocFolderDoc>) ??
  mongoose.model<DocFolderDoc>('DocFolder', folderSchema);

export interface DocFileDoc {
  projectId: Types.ObjectId;
  folderId: Types.ObjectId | null;
  name: string;
  originalName: string;
  publicId: string;
  kind: 'IMAGE' | 'FILE';
  format: string | null;
  bytes: number | null;
  visibility: (typeof POST_VISIBILITIES)[number];
  uploadedById: Types.ObjectId;
  deletedAt: Date | null;
  createdAt: Date;
}

const fileSchema = new Schema<DocFileDoc>(
  {
    projectId: { type: Schema.Types.ObjectId, required: true },
    folderId: { type: Schema.Types.ObjectId, default: null },
    name: { type: String, required: true, trim: true },
    originalName: { type: String, required: true },
    publicId: { type: String, required: true },
    kind: { type: String, enum: ['IMAGE', 'FILE'], required: true },
    format: { type: String, default: null },
    bytes: { type: Number, default: null },
    visibility: { type: String, enum: POST_VISIBILITIES, required: true, default: 'TEAM' },
    uploadedById: { type: Schema.Types.ObjectId, required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
fileSchema.index({ projectId: 1, folderId: 1, createdAt: -1 });
// One document per stored asset per project (among the ones not deleted). This is what makes
// "Save to Docs" idempotent, and lets a deleted document be saved again.
fileSchema.index(
  { projectId: 1, publicId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: { $type: 'null' } } },
);

export const DocFileModel: Model<DocFileDoc> =
  (mongoose.models['DocFile'] as Model<DocFileDoc>) ??
  mongoose.model<DocFileDoc>('DocFile', fileSchema);
