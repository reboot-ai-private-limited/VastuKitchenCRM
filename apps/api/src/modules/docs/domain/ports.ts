import type {
  NotificationRefDto,
  NotificationType,
  ProjectActivityType,
  ProjectStage,
  RoleName,
} from '@vastu/contracts';
import type {
  DocFile,
  DocFileFilter,
  DocFilePatch,
  DocFolder,
  NewDocFile,
  NewDocFolder,
} from './doc.entity.js';

export interface FolderRepositoryPort {
  /** Throws `AppError.conflict` when a sibling already has the name (case-insensitive). */
  create(folder: NewDocFolder): Promise<DocFolder>;
  findById(id: string): Promise<DocFolder | null>;
  /** Throws `AppError.conflict` on a name clash among the new siblings. */
  update(id: string, patch: { name?: string; parentId?: string | null }): Promise<DocFolder | null>;
  delete(id: string): Promise<boolean>;
  /** Every folder of the project (a project has dozens, never thousands). */
  listByProject(projectId: string): Promise<DocFolder[]>;
}

export interface FileRepositoryPort {
  /** Idempotent on (project, publicId): the same stored asset is one document, however often it is saved. */
  createIfNew(file: NewDocFile): Promise<{ file: DocFile; created: boolean }>;
  findById(id: string): Promise<DocFile | null>;
  update(id: string, patch: DocFilePatch): Promise<DocFile | null>;
  softDelete(id: string): Promise<boolean>;
  /** Newest first. */
  list(filter: DocFileFilter): Promise<DocFile[]>;
  /** Files directly in each folder (key `null` = top level). */
  countByFolder(projectId: string): Promise<Map<string | null, number>>;
  hasFilesIn(folderId: string): Promise<boolean>;
}

export interface ActorRef {
  id: string;
  role: RoleName;
}

export interface ProjectAccess {
  id: string;
  name: string;
  memberIds: string[];
  customerId: string;
  role: 'ADMIN' | 'MEMBER' | 'CUSTOMER';
  stage: ProjectStage;
}

/** What docs needs from projects (the adapter wraps projects' public contract). */
export interface ProjectsGatewayPort {
  /** Admin, member or the project's customer; NOT FOUND for anyone else. */
  access(actor: ActorRef, projectId: string): Promise<ProjectAccess>;
  recordActivity(
    projectId: string,
    activity: { type: ProjectActivityType; actorId: string | null; data: Record<string, unknown> },
  ): Promise<void>;
}

export interface DirectoryUser {
  id: string;
  name: string;
}

export interface UserDirectoryPort {
  find(ids: string[]): Promise<DirectoryUser[]>;
  activeAdminIds(): Promise<string[]>;
}

export interface DocsSettingsPort {
  /** The largest file accepted, in MB (Admin-editable). */
  maxFileMb(): Promise<number>;
}

export interface Alert {
  type: NotificationType;
  title: string;
  body: string;
  ref: NotificationRefDto;
}

/** Delivers alerts. It must never throw: a notification problem must not fail the upload. */
export interface AlertSenderPort {
  send(userIds: string[], alert: Alert): Promise<void>;
}
