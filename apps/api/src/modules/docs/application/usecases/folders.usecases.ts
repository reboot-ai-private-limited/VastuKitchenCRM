import {
  MAX_FOLDER_DEPTH,
  type CreateFolderBodyDto,
  type UpdateFolderBodyDto,
} from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import type { DocFolder } from '../../domain/doc.entity.js';
import type { ActorRef, FileRepositoryPort, FolderRepositoryPort } from '../../domain/ports.js';
import type { DocsAccessService } from '../services/docsAccess.js';

export interface FolderView {
  folder: DocFolder;
  fileCount: number;
}

const key = (name: string): string => name.trim().toLowerCase();

/** How many levels deep `id` sits (a top-level folder is depth 1). */
function depthOf(byId: Map<string, DocFolder>, id: string | null): number {
  let depth = 0;
  let cursor = id;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    depth++;
    cursor = byId.get(cursor)?.parentId ?? null;
  }
  return depth;
}

/** How many levels the subtree under (and including) `id` spans. */
function heightOf(folders: DocFolder[], id: string): number {
  const children = folders.filter((f) => f.parentId === id);
  return 1 + Math.max(0, ...children.map((c) => heightOf(folders, c.id)));
}

/** Is `candidate` the folder `id` itself, or one of its descendants? */
function isInsideOrSelf(
  byId: Map<string, DocFolder>,
  candidate: string | null,
  id: string,
): boolean {
  let cursor = candidate;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    if (cursor === id) return true;
    seen.add(cursor);
    cursor = byId.get(cursor)?.parentId ?? null;
  }
  return false;
}

export class ListFoldersUseCase {
  constructor(
    private readonly access: DocsAccessService,
    private readonly folders: FolderRepositoryPort,
    private readonly files: FileRepositoryPort,
  ) {}

  async execute(actor: ActorRef, projectId: string): Promise<FolderView[]> {
    const { viewer } = await this.access.forProject(projectId, actor);
    // The customer is shown a flat list of shared files, never the folder structure.
    if (!viewer.isStaff) return [];
    const [folders, counts] = await Promise.all([
      this.folders.listByProject(projectId),
      this.files.countByFolder(projectId),
    ]);
    return folders.map((folder) => ({ folder, fileCount: counts.get(folder.id) ?? 0 }));
  }
}

export class CreateFolderUseCase {
  constructor(
    private readonly access: DocsAccessService,
    private readonly folders: FolderRepositoryPort,
  ) {}

  async execute(
    actor: ActorRef,
    projectId: string,
    input: CreateFolderBodyDto,
  ): Promise<FolderView> {
    const { viewer } = await this.access.forProject(projectId, actor);
    this.access.assertStaff(viewer);

    if (input.parentId) {
      const all = await this.folders.listByProject(projectId);
      const byId = new Map(all.map((f) => [f.id, f]));
      if (!byId.has(input.parentId)) {
        throw AppError.badRequest('Choose a folder of this project.', [
          { path: ['parentId'], message: 'Not a folder of this project' },
        ]);
      }
      if (depthOf(byId, input.parentId) >= MAX_FOLDER_DEPTH) {
        throw AppError.badRequest(
          `Folders can be nested ${MAX_FOLDER_DEPTH} levels deep at most.`,
          [{ path: ['parentId'], message: 'Too deep' }],
        );
      }
    }
    const folder = await this.folders.create({
      projectId,
      parentId: input.parentId ?? null,
      name: input.name,
      createdById: actor.id,
    });
    return { folder, fileCount: 0 };
  }
}

export class UpdateFolderUseCase {
  constructor(
    private readonly access: DocsAccessService,
    private readonly folders: FolderRepositoryPort,
    private readonly files: FileRepositoryPort,
  ) {}

  async execute(
    actor: ActorRef,
    folderId: string,
    input: UpdateFolderBodyDto,
  ): Promise<FolderView> {
    const { folder, viewer } = await this.access.loadFolder(folderId, actor);
    this.access.assertStaff(viewer);

    const patch: { name?: string; parentId?: string | null } = {};
    if (input.name !== undefined) patch.name = input.name;

    if (input.parentId !== undefined && input.parentId !== folder.parentId) {
      const all = await this.folders.listByProject(folder.projectId);
      const byId = new Map(all.map((f) => [f.id, f]));
      if (input.parentId !== null && !byId.has(input.parentId)) {
        throw AppError.badRequest('Choose a folder of this project.', [
          { path: ['parentId'], message: 'Not a folder of this project' },
        ]);
      }
      // A folder cannot go inside itself or one of its own subfolders.
      if (isInsideOrSelf(byId, input.parentId, folderId)) {
        throw AppError.badRequest('A folder cannot be moved into itself.', [
          { path: ['parentId'], message: 'Would create a loop' },
        ]);
      }
      // The WHOLE moved subtree must still fit.
      if (depthOf(byId, input.parentId) + heightOf(all, folderId) > MAX_FOLDER_DEPTH) {
        throw AppError.badRequest(
          `Folders can be nested ${MAX_FOLDER_DEPTH} levels deep at most.`,
          [{ path: ['parentId'], message: 'Too deep' }],
        );
      }
      patch.parentId = input.parentId;
    }

    const updated = await this.folders.update(folderId, patch);
    if (!updated) throw AppError.notFound('Folder not found.');
    return {
      folder: updated,
      fileCount: (await this.files.countByFolder(folder.projectId)).get(folderId) ?? 0,
    };
  }
}

/** Only an EMPTY folder can go: nothing is ever lost by deleting one. */
export class DeleteFolderUseCase {
  constructor(
    private readonly access: DocsAccessService,
    private readonly folders: FolderRepositoryPort,
    private readonly files: FileRepositoryPort,
  ) {}

  async execute(actor: ActorRef, folderId: string): Promise<void> {
    const { folder, viewer } = await this.access.loadFolder(folderId, actor);
    this.access.assertStaff(viewer);

    const siblings = await this.folders.listByProject(folder.projectId);
    if (siblings.some((f) => f.parentId === folderId) || (await this.files.hasFilesIn(folderId))) {
      throw AppError.conflict('This folder is not empty. Move or delete what is inside it first.');
    }
    if (!(await this.folders.delete(folderId))) throw AppError.notFound('Folder not found.');
  }
}

export { key as folderKey };
