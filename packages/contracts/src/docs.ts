import { z } from 'zod';
import { postVisibilitySchema } from './projects.js';

/**
 * Project documents: nested folders and files with a per-file "share with client" switch. Files
 * are uploaded straight to storage (like photos), or saved from a photo already in a post or
 * to-do ("Save to Docs") without uploading it again.
 */
export const MAX_FOLDER_DEPTH = 5;
export const MAX_SAVE_BATCH = 20;

/** File types the Docs area accepts. The server checks every file against this list. */
export const DOC_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'csv',
  'txt',
  'rtf',
  'jpg',
  'jpeg',
  'png',
  'webp',
  'heic',
  'heif',
  'gif',
  'dwg',
  'dxf',
  'skp',
] as const;
export type DocExtension = (typeof DOC_EXTENSIONS)[number];

const person = z.object({ id: z.string(), name: z.string() });

/* ── folders ──────────────────────────────────────────────────────────────── */

export const folderSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  /** Null at the top level. */
  parentId: z.string().nullable(),
  name: z.string(),
  /** Files directly in this folder (not in its subfolders). */
  fileCount: z.number().int(),
  createdAt: z.string(),
});
export type FolderDto = z.infer<typeof folderSchema>;

export const createFolderBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  parentId: z.string().min(1).optional(),
});
export type CreateFolderBodyDto = z.infer<typeof createFolderBodySchema>;

/** `parentId: null` moves to the top level. */
export const updateFolderBodySchema = z
  .object({ name: z.string().trim().min(1).max(80), parentId: z.string().min(1).nullable() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateFolderBodyDto = z.infer<typeof updateFolderBodySchema>;

/* ── files ────────────────────────────────────────────────────────────────── */

export const docFileSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  /** Null at the top level. Never shown to the customer. */
  folderId: z.string().nullable(),
  /** What it is called in Docs. */
  name: z.string(),
  originalName: z.string(),
  kind: z.enum(['IMAGE', 'FILE']),
  format: z.string().nullable(),
  bytes: z.number().int().nullable(),
  /** `CLIENT` = shared with the customer; `TEAM` = staff only. */
  visibility: postVisibilitySchema,
  uploadedBy: person.nullable(),
  url: z.string(),
  /** A small preview, for images only. */
  thumbUrl: z.string().nullable(),
  /** A large picture for the viewer: the photo itself, or a PDF's first page. Null for other types. */
  previewUrl: z.string().nullable(),
  downloadUrl: z.string(),
  /** Its uploader or an Admin. */
  canDelete: z.boolean(),
  createdAt: z.string(),
});
export type DocFileDto = z.infer<typeof docFileSchema>;

/** Register a file the app has just uploaded with a ticket. */
export const registerFileBodySchema = z.object({
  /** From the storage provider's upload response. */
  publicId: z.string().min(1).max(300),
  /** The file's extension, lower case, from the upload response (`pdf`, `dwg` …). */
  format: z.string().trim().toLowerCase().min(1).max(10),
  originalName: z.string().trim().min(1).max(200),
  bytes: z.number().int().positive(),
  /**
   * The storage provider's `resource_type` for the upload. A PDF is stored as an `image` (that is what
   * makes first-page previews possible); a Word or Excel file is `raw`. Omit it to have the API work it out.
   */
  resourceType: z.enum(['image', 'raw']).optional(),
  /** Defaults to the original name. */
  name: z.string().trim().min(1).max(200).optional(),
  folderId: z.string().min(1).optional(),
  /** Defaults to TEAM. A customer's files are always shared. */
  visibility: postVisibilitySchema.default('TEAM'),
});
export type RegisterFileBodyDto = z.infer<typeof registerFileBodySchema>;

export const updateFileBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    /** `null` moves to the top level. */
    folderId: z.string().min(1).nullable(),
    visibility: postVisibilitySchema,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateFileBodyDto = z.infer<typeof updateFileBodySchema>;

/** "Save to Docs": photos already in a post, comment or to-do. Nothing is uploaded again. */
export const saveFromPhotosBodySchema = z.object({
  items: z
    .array(
      z.object({
        publicId: z.string().min(1).max(300),
        /** A name for the file; a dated default is used otherwise. */
        name: z.string().trim().min(1).max(200).optional(),
      }),
    )
    .min(1)
    .max(MAX_SAVE_BATCH),
  folderId: z.string().min(1).optional(),
  /** The app passes the source's visibility (a Client post's photo → CLIENT). Defaults to TEAM. */
  visibility: postVisibilitySchema.default('TEAM'),
});
export type SaveFromPhotosBodyDto = z.infer<typeof saveFromPhotosBodySchema>;

export const saveResultSchema = z.array(z.object({ file: docFileSchema, created: z.boolean() }));
export type SaveResultDto = z.infer<typeof saveResultSchema>;

export const listFilesQuerySchema = z.object({
  /** A folder id, or `root` for files at the top level. Omit for every file in the project. */
  folderId: z.string().min(1).optional(),
  /** Part of a file name. */
  search: z.string().trim().min(1).max(100).optional(),
  /** `true`: only files shared with the customer. */
  shared: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type ListFilesQueryDto = z.infer<typeof listFilesQuerySchema>;

export const docsProjectParamsSchema = z.object({ projectId: z.string().min(1) });
export const folderIdParamsSchema = z.object({ folderId: z.string().min(1) });
export const fileIdParamsSchema = z.object({ fileId: z.string().min(1) });
