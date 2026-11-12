import { Types, isValidObjectId, type HydratedDocument } from 'mongoose';
import { AppError } from '@/shared/errors/AppError.js';
import { escapeRegex, isDuplicateKey } from '@/shared/db/mongoErrors.js';
import type {
  DocFile,
  DocFileFilter,
  DocFilePatch,
  DocFolder,
  NewDocFile,
  NewDocFolder,
} from '../domain/doc.entity.js';
import type { FileRepositoryPort, FolderRepositoryPort } from '../domain/ports.js';
import { DocFileModel, DocFolderModel, type DocFileDoc, type DocFolderDoc } from './doc.schemas.js';

const idOrNull = (v: { toString(): string } | null): string | null => (v ? v.toString() : null);
const keyOf = (name: string): string => name.trim().toLowerCase();
const nameTaken = () => AppError.conflict('A folder with this name already exists here.');

const toFolder = (d: HydratedDocument<DocFolderDoc>): DocFolder => ({
  id: d.id as string,
  projectId: d.projectId.toString(),
  parentId: idOrNull(d.parentId),
  name: d.name,
  createdById: d.createdById.toString(),
  createdAt: d.createdAt,
});

const toFile = (d: HydratedDocument<DocFileDoc>): DocFile => ({
  id: d.id as string,
  projectId: d.projectId.toString(),
  folderId: idOrNull(d.folderId),
  name: d.name,
  originalName: d.originalName,
  publicId: d.publicId,
  kind: d.kind,
  resourceType: d.resourceType ?? null,
  format: d.format,
  bytes: d.bytes,
  visibility: d.visibility,
  uploadedById: d.uploadedById.toString(),
  createdAt: d.createdAt,
});

export class MongoFolderRepository implements FolderRepositoryPort {
  async create(folder: NewDocFolder): Promise<DocFolder> {
    try {
      return toFolder(await DocFolderModel.create({ ...folder, nameKey: keyOf(folder.name) }));
    } catch (err) {
      if (isDuplicateKey(err)) throw nameTaken();
      throw err;
    }
  }

  async findById(id: string): Promise<DocFolder | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await DocFolderModel.findById(id);
    return doc ? toFolder(doc) : null;
  }

  async update(
    id: string,
    patch: { name?: string; parentId?: string | null },
  ): Promise<DocFolder | null> {
    if (!isValidObjectId(id)) return null;
    const set: Record<string, unknown> = {};
    if (patch.name !== undefined) {
      set['name'] = patch.name.trim();
      set['nameKey'] = keyOf(patch.name);
    }
    if (patch.parentId !== undefined) set['parentId'] = patch.parentId;
    try {
      const doc = await DocFolderModel.findByIdAndUpdate(id, { $set: set }, { new: true });
      return doc ? toFolder(doc) : null;
    } catch (err) {
      if (isDuplicateKey(err)) throw nameTaken();
      throw err;
    }
  }

  async delete(id: string): Promise<boolean> {
    if (!isValidObjectId(id)) return false;
    return (await DocFolderModel.deleteOne({ _id: id })).deletedCount === 1;
  }

  async listByProject(projectId: string): Promise<DocFolder[]> {
    if (!isValidObjectId(projectId)) return [];
    return (await DocFolderModel.find({ projectId }).sort({ nameKey: 1 }).limit(1000)).map(
      toFolder,
    );
  }
}

export class MongoFileRepository implements FileRepositoryPort {
  async createIfNew(file: NewDocFile): Promise<{ file: DocFile; created: boolean }> {
    try {
      return { file: toFile(await DocFileModel.create(file)), created: true };
    } catch (err) {
      // The unique (project, publicId) index says this asset is already a document.
      if (!isDuplicateKey(err)) throw err;
      const existing = await DocFileModel.findOne({
        projectId: file.projectId,
        publicId: file.publicId,
        deletedAt: null,
      });
      if (!existing) throw err;
      return { file: toFile(existing), created: false };
    }
  }

  async findById(id: string): Promise<DocFile | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await DocFileModel.findOne({ _id: id, deletedAt: null });
    return doc ? toFile(doc) : null;
  }

  async update(id: string, patch: DocFilePatch): Promise<DocFile | null> {
    if (!isValidObjectId(id)) return null;
    const set: Record<string, unknown> = { ...patch };
    if (patch.name !== undefined) set['name'] = patch.name.trim();
    const doc = await DocFileModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: set },
      { new: true },
    );
    return doc ? toFile(doc) : null;
  }

  async softDelete(id: string): Promise<boolean> {
    if (!isValidObjectId(id)) return false;
    const res = await DocFileModel.updateOne(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
    );
    return res.modifiedCount === 1;
  }

  async list(f: DocFileFilter): Promise<DocFile[]> {
    if (!isValidObjectId(f.projectId)) return [];
    const filter: Record<string, unknown> = {
      projectId: f.projectId,
      deletedAt: null,
      visibility: { $in: f.visibilities },
    };
    if (f.folderId !== undefined) {
      if (f.folderId !== null && !isValidObjectId(f.folderId)) return [];
      filter['folderId'] = f.folderId;
    }
    if (f.search) filter['name'] = new RegExp(escapeRegex(f.search), 'i');
    return (await DocFileModel.find(filter).sort({ createdAt: -1, _id: -1 }).limit(1000)).map(
      toFile,
    );
  }

  async countByFolder(projectId: string): Promise<Map<string | null, number>> {
    const out = new Map<string | null, number>();
    if (!isValidObjectId(projectId)) return out;
    const rows = await DocFileModel.aggregate<{ _id: Types.ObjectId | null; n: number }>([
      { $match: { projectId: new Types.ObjectId(projectId), deletedAt: null } },
      { $group: { _id: '$folderId', n: { $sum: 1 } } },
    ]);
    for (const r of rows) out.set(r._id ? r._id.toString() : null, r.n);
    return out;
  }

  async hasFilesIn(folderId: string): Promise<boolean> {
    if (!isValidObjectId(folderId)) return false;
    return (await DocFileModel.exists({ folderId, deletedAt: null })) !== null;
  }
}
