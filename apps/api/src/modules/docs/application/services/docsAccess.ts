import { AppError } from '@/shared/errors/AppError.js';
import type {
  ActorRef,
  FileRepositoryPort,
  FolderRepositoryPort,
  ProjectAccess,
  ProjectsGatewayPort,
} from '../../domain/ports.js';
import type { DocFile, DocFolder } from '../../domain/doc.entity.js';

export interface Viewer {
  actor: ActorRef;
  /** The Admin or a member of the project. */
  isStaff: boolean;
  isCustomer: boolean;
  isAdmin: boolean;
}

export interface Access {
  project: ProjectAccess;
  viewer: Viewer;
}

/**
 * Staff (Admin, members) see and organise everything; the project's customer sees only the files
 * shared with them, flat, and never learns a folder exists. Anyone else is told "not found".
 */
export class DocsAccessService {
  constructor(
    private readonly folders: FolderRepositoryPort,
    private readonly files: FileRepositoryPort,
    private readonly projects: ProjectsGatewayPort,
  ) {}

  async forProject(projectId: string, actor: ActorRef): Promise<Access> {
    const project = await this.projects.access(actor, projectId);
    return {
      project,
      viewer: {
        actor,
        isStaff: project.role !== 'CUSTOMER',
        isCustomer: project.role === 'CUSTOMER',
        isAdmin: project.role === 'ADMIN',
      },
    };
  }

  /** Only the team may organise folders. */
  assertStaff(viewer: Viewer): void {
    if (!viewer.isStaff) throw AppError.forbidden('Only the team can do that.');
  }

  async loadFolder(folderId: string, actor: ActorRef): Promise<Access & { folder: DocFolder }> {
    const folder = await this.folders.findById(folderId);
    if (!folder) throw AppError.notFound('Folder not found.');
    const access = await this.forProject(folder.projectId, actor);
    // The customer does not see folders at all.
    if (!access.viewer.isStaff) throw AppError.notFound('Folder not found.');
    return { ...access, folder };
  }

  async loadFile(fileId: string, actor: ActorRef): Promise<Access & { file: DocFile }> {
    const file = await this.files.findById(fileId);
    if (!file) throw AppError.notFound('File not found.');
    const access = await this.forProject(file.projectId, actor);
    // A customer only ever finds the files shared with them.
    if (access.viewer.isCustomer && file.visibility !== 'CLIENT')
      throw AppError.notFound('File not found.');
    return { ...access, file };
  }
}
