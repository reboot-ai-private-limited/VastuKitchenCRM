import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import {
  createFolderBodySchema,
  docFileSchema,
  docsProjectParamsSchema,
  fileIdParamsSchema,
  folderIdParamsSchema,
  folderSchema,
  listFilesQuerySchema,
  registerFileBodySchema,
  saveFromPhotosBodySchema,
  saveResultSchema,
  updateFileBodySchema,
  updateFolderBodySchema,
  uploadTicketSchema,
} from '@vastu/contracts';
import { authenticate } from '@/shared/http/authenticate.middleware.js';
import { errorResponse, okResponse, openApiRegistry } from '@/shared/http/swagger.util.js';
import { validate } from '@/shared/http/validate.middleware.js';

const TAG = ['Docs'];
const security = [{ bearerAuth: [] }];
const json = (schema: z.ZodTypeAny) => ({ content: { 'application/json': { schema } } });
const notFound = errorResponse('Not found (also returned when you are not on the project)');
const project = { params: docsProjectParamsSchema };
const folder = { params: folderIdParamsSchema };
const file = { params: fileIdParamsSchema };

const doc = (
  method: 'get' | 'post' | 'patch' | 'delete',
  path: string,
  summary: string,
  request: Record<string, unknown> | undefined,
  responses: Record<string | number, unknown>,
  description?: string,
) =>
  openApiRegistry.registerPath({
    method,
    path,
    tags: TAG,
    security,
    summary,
    ...(description ? { description } : {}),
    ...(request ? { request } : {}),
    responses,
  } as never);

doc(
  'post',
  '/api/projects/{projectId}/files/uploads/sign',
  'A signed ticket to upload a document straight to storage',
  project,
  {
    200: okResponse('Upload ticket', uploadTicketSchema),
    404: notFound,
    503: errorResponse('Storage not configured'),
  },
  'POST the file to `url` as multipart/form-data with `fields` first. Then call `POST /projects/{projectId}/files` with what storage answered: `publicId`, `bytes`, the file name as `originalName`, and `format` = the extension of that file name (e.g. `pdf`). Any project member, and the customer, can upload.',
);
doc(
  'get',
  '/api/projects/{projectId}/folders',
  'The folder tree, as a flat list (the team); empty for the customer',
  project,
  { 200: okResponse('Folders with their file counts', z.array(folderSchema)), 404: notFound },
);
doc(
  'post',
  '/api/projects/{projectId}/folders',
  'Create a folder (the team)',
  { ...project, body: json(createFolderBodySchema) },
  {
    201: okResponse('Created', folderSchema),
    400: errorResponse('Not a folder of this project, or too deep (5 levels)'),
    403: errorResponse('The customer cannot'),
    409: errorResponse('A sibling already has that name'),
  },
);
doc(
  'patch',
  '/api/folders/{folderId}',
  'Rename or move a folder (`parentId: null` = top level)',
  { ...folder, body: json(updateFolderBodySchema) },
  {
    200: okResponse('Updated', folderSchema),
    400: errorResponse('Would loop, or too deep'),
    409: errorResponse('Name clash'),
  },
);
doc('delete', '/api/folders/{folderId}', 'Delete an EMPTY folder', folder, {
  200: okResponse('Deleted', z.object({})),
  409: errorResponse('Not empty'),
});
doc(
  'get',
  '/api/projects/{projectId}/files',
  'Files (`folderId` or `root`, `search`, `shared=true`). The customer sees only what is shared with them, flat',
  { ...project, query: listFilesQuerySchema },
  { 200: okResponse('Files, newest first', z.array(docFileSchema)), 404: notFound },
);
doc(
  'post',
  '/api/projects/{projectId}/files',
  'Register a file you have just uploaded',
  { ...project, body: json(registerFileBodySchema) },
  {
    201: okResponse('Added', docFileSchema),
    400: errorResponse('Wrong folder, disallowed type, or too large'),
  },
  "The server checks the file was uploaded to THIS project, that its type is allowed, and that it is not larger than the `docs.maxFileMb` setting. A customer's files are always shared and at the top level. Registering the same upload twice returns the same file.",
);
doc(
  'post',
  '/api/projects/{projectId}/files/from-photos',
  'Save to Docs: keep photos that are already in a post, comment or to-do',
  { ...project, body: json(saveFromPhotosBodySchema) },
  {
    201: okResponse(
      'One entry per photo; `created: false` when it was already in Docs',
      saveResultSchema,
    ),
    400: errorResponse('Not a photo of this project'),
  },
  "Nothing is uploaded or copied: each document points at the same stored image. Pass the source's visibility (a Client post's photo → `CLIENT`). Saving never alerts anyone; it adds a quiet line to the project timeline.",
);
doc('get', '/api/files/{fileId}', 'One file', file, {
  200: okResponse('The file', docFileSchema),
  404: notFound,
});
doc(
  'patch',
  '/api/files/{fileId}',
  'Rename, move, or share with the customer (the team)',
  { ...file, body: json(updateFileBodySchema) },
  {
    200: okResponse('Updated', docFileSchema),
    403: errorResponse('The customer cannot'),
    404: notFound,
  },
  'Sharing a team file tells the customer.',
);
doc(
  'delete',
  '/api/files/{fileId}',
  'Delete a file (its uploader, or Admin). The stored asset is kept',
  file,
  { 200: okResponse('Deleted', z.object({})), 403: errorResponse('Not yours'), 404: notFound },
);

export interface DocsControllers {
  sign: RequestHandler;
  listFolders: RequestHandler;
  createFolder: RequestHandler;
  updateFolder: RequestHandler;
  deleteFolder: RequestHandler;
  listFiles: RequestHandler;
  registerFile: RequestHandler;
  saveFromPhotos: RequestHandler;
  getFile: RequestHandler;
  updateFile: RequestHandler;
  deleteFile: RequestHandler;
}

/**
 * Mounted at the ROOT of `/api` (see the note in docs/03-architecture/overview.md): authentication
 * is applied PER ROUTE, never with `router.use(authenticate)`, so requests that merely pass through
 * this router (public links, Swagger) are left alone. Access is decided by the project (member,
 * customer, or not found) inside the use cases.
 */
export function buildDocsRouter(c: DocsControllers): Router {
  const router = Router();
  const projectParams = validate({ params: docsProjectParamsSchema });

  router.post('/projects/:projectId/files/uploads/sign', authenticate, projectParams, c.sign);
  router.post(
    '/projects/:projectId/files/from-photos',
    authenticate,
    validate({ params: docsProjectParamsSchema, body: saveFromPhotosBodySchema }),
    c.saveFromPhotos,
  );
  router.get(
    '/projects/:projectId/files',
    authenticate,
    validate({ params: docsProjectParamsSchema, query: listFilesQuerySchema }),
    c.listFiles,
  );
  router.post(
    '/projects/:projectId/files',
    authenticate,
    validate({ params: docsProjectParamsSchema, body: registerFileBodySchema }),
    c.registerFile,
  );
  router.get('/projects/:projectId/folders', authenticate, projectParams, c.listFolders);
  router.post(
    '/projects/:projectId/folders',
    authenticate,
    validate({ params: docsProjectParamsSchema, body: createFolderBodySchema }),
    c.createFolder,
  );

  router.patch(
    '/folders/:folderId',
    authenticate,
    validate({ params: folderIdParamsSchema, body: updateFolderBodySchema }),
    c.updateFolder,
  );
  router.delete(
    '/folders/:folderId',
    authenticate,
    validate({ params: folderIdParamsSchema }),
    c.deleteFolder,
  );
  router.get('/files/:fileId', authenticate, validate({ params: fileIdParamsSchema }), c.getFile);
  router.patch(
    '/files/:fileId',
    authenticate,
    validate({ params: fileIdParamsSchema, body: updateFileBodySchema }),
    c.updateFile,
  );
  router.delete(
    '/files/:fileId',
    authenticate,
    validate({ params: fileIdParamsSchema }),
    c.deleteFile,
  );
  return router;
}
