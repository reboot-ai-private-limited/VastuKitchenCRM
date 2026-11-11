import type { Router } from 'express';
import type { IdentityPublicContract } from '@/modules/identity/identity.public.js';
import type { NotificationsPublicContract } from '@/modules/notifications/notifications.public.js';
import type { ProjectsPublicContract } from '@/modules/projects/projects.public.js';
import type { SettingsPublicContract } from '@/modules/settings/settings.public.js';
import type { StoragePort } from '@/shared/storage/storage.port.js';
import { DocAlerts } from './application/services/docAlerts.js';
import { DocViewBuilder } from './application/services/docViews.js';
import { DocsAccessService } from './application/services/docsAccess.js';
import {
  CreateFolderUseCase,
  DeleteFolderUseCase,
  ListFoldersUseCase,
  UpdateFolderUseCase,
} from './application/usecases/folders.usecases.js';
import {
  DeleteFileUseCase,
  GetFileUseCase,
  ListFilesUseCase,
  RegisterFileUseCase,
  SaveFromPhotosUseCase,
  SignFileUploadUseCase,
  UpdateFileUseCase,
} from './application/usecases/files.usecases.js';
import {
  IdentityUserDirectory,
  NotificationsAlertSender,
  ProjectsGateway,
  SettingsGateway,
} from './infrastructure/gateways.adapter.js';
import { MongoFileRepository, MongoFolderRepository } from './infrastructure/mongoDoc.adapters.js';
import * as c from './interface/docs.controller.js';
import { buildDocsRouter } from './interface/docs.route.js';
import type { DocsPublicContract } from './docs.public.js';

export interface DocsContainer {
  contract: DocsPublicContract;
  /** Mounted at `/api`: the router's paths are complete. Authenticates per route; mount it last. */
  buildRouter: () => Router;
}

export interface DocsDeps {
  /** Other modules' public contracts: the only ways docs reaches them. */
  projects: ProjectsPublicContract;
  identity: IdentityPublicContract;
  notifications: NotificationsPublicContract;
  settings: SettingsPublicContract;
  storage: StoragePort;
}

export function buildDocsContainer(deps: DocsDeps): DocsContainer {
  // 1. Adapters
  const folders = new MongoFolderRepository();
  const files = new MongoFileRepository();
  const projects = new ProjectsGateway(deps.projects);
  const directory = new IdentityUserDirectory(deps.identity);
  const settings = new SettingsGateway(deps.settings);
  const sender = new NotificationsAlertSender(deps.notifications);

  // 2. Services and use cases, depending only on ports
  const access = new DocsAccessService(folders, files, projects);
  const alerts = new DocAlerts(sender, directory);
  const views = new DocViewBuilder(directory, deps.storage);

  return {
    contract: {},
    buildRouter: () =>
      buildDocsRouter({
        sign: c.makeSign(new SignFileUploadUseCase(access, deps.storage)),
        listFolders: c.makeListFolders(new ListFoldersUseCase(access, folders, files)),
        createFolder: c.makeCreateFolder(new CreateFolderUseCase(access, folders)),
        updateFolder: c.makeUpdateFolder(new UpdateFolderUseCase(access, folders, files)),
        deleteFolder: c.makeDeleteFolder(new DeleteFolderUseCase(access, folders, files)),
        listFiles: c.makeListFiles(new ListFilesUseCase(access, files, views)),
        registerFile: c.makeRegisterFile(
          new RegisterFileUseCase(
            access,
            files,
            folders,
            projects,
            directory,
            deps.storage,
            settings,
            alerts,
            views,
          ),
        ),
        saveFromPhotos: c.makeSaveFromPhotos(
          new SaveFromPhotosUseCase(access, files, folders, projects, deps.storage, views),
        ),
        getFile: c.makeGetFile(new GetFileUseCase(access, views)),
        updateFile: c.makeUpdateFile(
          new UpdateFileUseCase(access, files, folders, projects, alerts, views),
        ),
        deleteFile: c.makeDeleteFile(new DeleteFileUseCase(access, files)),
      }),
  };
}
