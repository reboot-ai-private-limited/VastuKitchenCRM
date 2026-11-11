import type {
  ListFilesQueryDto,
  RegisterFileBodyDto,
  SaveFromPhotosBodyDto,
  UpdateFileBodyDto,
  UploadTicketDto,
} from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import { isInFolder, projectFilesFolder, projectFolder } from '@/shared/storage/folders.js';
import type { StoragePort } from '@/shared/storage/storage.port.js';
import { MB, isAllowedFormat, isImageFormat, type DocFile } from '../../domain/doc.entity.js';
import type {
  ActorRef,
  DirectoryUser,
  DocsSettingsPort,
  FileRepositoryPort,
  FolderRepositoryPort,
  ProjectsGatewayPort,
  UserDirectoryPort,
} from '../../domain/ports.js';
import type { DocAlerts } from '../services/docAlerts.js';
import type { DocViewBuilder, FileView } from '../services/docViews.js';
import type { Access, DocsAccessService } from '../services/docsAccess.js';

/** Staff pick the folder and visibility; the customer's files are always shared, at the top level. */
async function resolvePlacement(
  access: Access,
  folders: FolderRepositoryPort,
  requested: { folderId?: string | undefined; visibility: 'TEAM' | 'CLIENT' },
): Promise<{ folderId: string | null; visibility: 'TEAM' | 'CLIENT'; folderName: string | null }> {
  if (access.viewer.isCustomer) return { folderId: null, visibility: 'CLIENT', folderName: null };
  if (!requested.folderId)
    return { folderId: null, visibility: requested.visibility, folderName: null };
  const folder = await folders.findById(requested.folderId);
  if (!folder || folder.projectId !== access.project.id) {
    throw AppError.badRequest('Choose a folder of this project.', [
      { path: ['folderId'], message: 'Not a folder of this project' },
    ]);
  }
  return { folderId: folder.id, visibility: requested.visibility, folderName: folder.name };
}

const nameOf = (users: DirectoryUser[], id: string): string =>
  users.find((u) => u.id === id)?.name ?? 'Someone';

/** A ticket to upload a document into THIS project's files folder (the customer may too). */
export class SignFileUploadUseCase {
  constructor(
    private readonly access: DocsAccessService,
    private readonly storage: StoragePort,
  ) {}

  async execute(actor: ActorRef, projectId: string): Promise<UploadTicketDto> {
    const { project } = await this.access.forProject(projectId, actor);
    return this.storage.signFileUpload(projectFilesFolder(this.storage.rootFolder, project.id));
  }
}

/** Registers a file the app has just uploaded. */
export class RegisterFileUseCase {
  constructor(
    private readonly access: DocsAccessService,
    private readonly files: FileRepositoryPort,
    private readonly folders: FolderRepositoryPort,
    private readonly projects: ProjectsGatewayPort,
    private readonly directory: UserDirectoryPort,
    private readonly storage: StoragePort,
    private readonly settings: DocsSettingsPort,
    private readonly alerts: DocAlerts,
    private readonly views: DocViewBuilder,
  ) {}

  async execute(actor: ActorRef, projectId: string, input: RegisterFileBodyDto): Promise<FileView> {
    const ctx = await this.access.forProject(projectId, actor);
    const { project, viewer } = ctx;

    // The server's own rules: where it was uploaded, what type it is, how big.
    if (!isInFolder(input.publicId, projectFilesFolder(this.storage.rootFolder, project.id))) {
      throw AppError.badRequest('This file was not uploaded to this project.', [
        { path: ['publicId'], message: 'Upload files through this project' },
      ]);
    }
    if (!isAllowedFormat(input.format)) {
      throw AppError.badRequest('This type of file is not allowed.', [
        { path: ['format'], message: `.${input.format} files are not accepted` },
      ]);
    }
    // A stored document's id ends in its extension; make sure the claimed type is the real one.
    if (
      !isImageFormat(input.format) &&
      !input.publicId.toLowerCase().endsWith(`.${input.format}`)
    ) {
      throw AppError.badRequest('The file type does not match the upload.', [
        { path: ['format'], message: 'Does not match the uploaded file' },
      ]);
    }
    const maxMb = await this.settings.maxFileMb();
    if (input.bytes > maxMb * MB) {
      throw AppError.badRequest(`Files can be at most ${maxMb} MB.`, [
        { path: ['bytes'], message: `Larger than ${maxMb} MB` },
      ]);
    }

    const placement = await resolvePlacement(ctx, this.folders, input);
    const { file, created } = await this.files.createIfNew({
      projectId,
      folderId: placement.folderId,
      name: input.name ?? input.originalName,
      originalName: input.originalName,
      publicId: input.publicId,
      kind: isImageFormat(input.format) ? 'IMAGE' : 'FILE',
      format: input.format,
      bytes: input.bytes,
      visibility: placement.visibility,
      uploadedById: actor.id,
    });

    // A retry (the same upload registered twice) returns the stored file and announces nothing.
    if (created) {
      const uploaderName = nameOf(await this.directory.find([actor.id]), actor.id);
      await this.projects.recordActivity(projectId, {
        type: 'FILE_ADDED',
        actorId: actor.id,
        data: {
          fileId: file.id,
          fileName: file.name,
          folderName: placement.folderName,
          shared: file.visibility === 'CLIENT',
        },
      });
      if (viewer.isCustomer) await this.alerts.addedByCustomer(project, file, uploaderName);
      else await this.alerts.addedByStaff(project, file, uploaderName);
    }
    return (await this.views.build([file], viewer))[0]!;
  }
}

/**
 * "Save to Docs": photos that already sit in a post, comment or to-do. NOTHING is uploaded or
 * copied — the new document points at the same stored image. Saving the same photo twice returns
 * the existing document. The knowledge of an (unguessable) photo id is what proves you may see it,
 * and it must lie in THIS project's photo folder.
 */
export class SaveFromPhotosUseCase {
  constructor(
    private readonly access: DocsAccessService,
    private readonly files: FileRepositoryPort,
    private readonly folders: FolderRepositoryPort,
    private readonly projects: ProjectsGatewayPort,
    private readonly storage: StoragePort,
    private readonly views: DocViewBuilder,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    actor: ActorRef,
    projectId: string,
    input: SaveFromPhotosBodyDto,
  ): Promise<Array<{ view: FileView; created: boolean }>> {
    const ctx = await this.access.forProject(projectId, actor);
    const { project, viewer } = ctx;

    const photoFolder = projectFolder(this.storage.rootFolder, project.id);
    input.items.forEach((item, index) => {
      if (!isInFolder(item.publicId, photoFolder)) {
        throw AppError.badRequest('A photo does not belong to this project.', [
          { path: ['items', index, 'publicId'], message: 'Not a photo of this project' },
        ]);
      }
    });
    const placement = await resolvePlacement(ctx, this.folders, input);

    const stamp = this.now().toISOString().slice(0, 10);
    const seen = new Set<string>();
    const unique = input.items.filter((i) => !seen.has(i.publicId) && !!seen.add(i.publicId));

    const results: Array<{ file: DocFile; created: boolean }> = [];
    for (const [index, item] of unique.entries()) {
      results.push(
        await this.files.createIfNew({
          projectId,
          folderId: placement.folderId,
          name:
            item.name ?? (unique.length > 1 ? `Photo ${stamp} (${index + 1})` : `Photo ${stamp}`),
          originalName: item.name ?? `Photo ${stamp}`,
          publicId: item.publicId,
          kind: 'IMAGE',
          format: null,
          bytes: null,
          visibility: placement.visibility,
          uploadedById: actor.id,
        }),
      );
    }

    const made = results.filter((r) => r.created);
    if (made.length > 0) {
      // A quiet line on the timeline; no alert, because the photos were announced when posted.
      await this.projects.recordActivity(projectId, {
        type: 'FILES_SAVED',
        actorId: actor.id,
        data: {
          count: made.length,
          folderName: placement.folderName,
          names: made.slice(0, 3).map((r) => r.file.name),
        },
      });
    }
    const built = await this.views.build(
      results.map((r) => r.file),
      viewer,
    );
    return built.map((view, i) => ({ view, created: results[i]!.created }));
  }
}

export class ListFilesUseCase {
  constructor(
    private readonly access: DocsAccessService,
    private readonly files: FileRepositoryPort,
    private readonly views: DocViewBuilder,
  ) {}

  async execute(actor: ActorRef, projectId: string, query: ListFilesQueryDto): Promise<FileView[]> {
    const { viewer } = await this.access.forProject(projectId, actor);
    const items = await this.files.list({
      projectId,
      // The customer asks about nothing but files: no folders, only what is shared with them.
      folderId:
        viewer.isCustomer || query.folderId === undefined
          ? undefined
          : query.folderId === 'root'
            ? null
            : query.folderId,
      search: query.search,
      visibilities: viewer.isCustomer || query.shared === true ? ['CLIENT'] : ['CLIENT', 'TEAM'],
    });
    return this.views.build(items, viewer);
  }
}

export class GetFileUseCase {
  constructor(
    private readonly access: DocsAccessService,
    private readonly views: DocViewBuilder,
  ) {}

  async execute(actor: ActorRef, fileId: string): Promise<FileView> {
    const { file, viewer } = await this.access.loadFile(fileId, actor);
    return (await this.views.build([file], viewer))[0]!;
  }
}

/** Rename, move, or change who it is shared with (the team only). Sharing tells the customer. */
export class UpdateFileUseCase {
  constructor(
    private readonly access: DocsAccessService,
    private readonly files: FileRepositoryPort,
    private readonly folders: FolderRepositoryPort,
    private readonly projects: ProjectsGatewayPort,
    private readonly alerts: DocAlerts,
    private readonly views: DocViewBuilder,
  ) {}

  async execute(actor: ActorRef, fileId: string, input: UpdateFileBodyDto): Promise<FileView> {
    const ctx = await this.access.loadFile(fileId, actor);
    this.access.assertStaff(ctx.viewer);
    // Captured now: a repository may hand back a live object that the update below mutates.
    const wasShared = ctx.file.visibility === 'CLIENT';

    const patch: { name?: string; folderId?: string | null; visibility?: 'TEAM' | 'CLIENT' } = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.visibility !== undefined) patch.visibility = input.visibility;
    if (input.folderId !== undefined) {
      if (input.folderId !== null) {
        const folder = await this.folders.findById(input.folderId);
        if (!folder || folder.projectId !== ctx.file.projectId) {
          throw AppError.badRequest('Choose a folder of this project.', [
            { path: ['folderId'], message: 'Not a folder of this project' },
          ]);
        }
      }
      patch.folderId = input.folderId;
    }

    const updated = await this.files.update(fileId, patch);
    if (!updated) throw AppError.notFound('File not found.');

    if (patch.visibility === 'CLIENT' && !wasShared) {
      await this.projects.recordActivity(updated.projectId, {
        type: 'FILE_SHARED',
        actorId: actor.id,
        data: { fileId, fileName: updated.name },
      });
      await this.alerts.sharedWithCustomer(ctx.project, updated);
    }
    return (await this.views.build([updated], ctx.viewer))[0]!;
  }
}

/** Its uploader or an Admin. Hides the document; the stored asset is never deleted. */
export class DeleteFileUseCase {
  constructor(
    private readonly access: DocsAccessService,
    private readonly files: FileRepositoryPort,
  ) {}

  async execute(actor: ActorRef, fileId: string): Promise<void> {
    const { file, viewer } = await this.access.loadFile(fileId, actor);
    if (!viewer.isAdmin && file.uploadedById !== actor.id)
      throw AppError.forbidden('You can only delete files you added.');
    if (!(await this.files.softDelete(fileId))) throw AppError.notFound('File not found.');
  }
}
