import {
  DOC_EXTENSIONS,
  MAX_FOLDER_DEPTH,
  MAX_SAVE_BATCH,
  type DocFileDto,
  type FolderDto,
  type SaveResultDto,
} from '@vastu/contracts';

export { MAX_FOLDER_DEPTH, MAX_SAVE_BATCH };

/** Lower-case extension of a file name, or '' if it has none. */
export function fileExtension(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 && i < name.length - 1 ? name.slice(i + 1).toLowerCase() : '';
}

/**
 * Why a file can't go to Docs, or null. Only what the browser can know for certain: the type list.
 * The size limit is a setting the server owns (`docs.maxFileMb`), so a too-big file is reported from the API's own message.
 */
export function fileProblem(file: { name: string; size: number }): string | null {
  const ext = fileExtension(file.name);
  if (!ext || !(DOC_EXTENSIONS as readonly string[]).includes(ext)) {
    return `${file.name}: .${ext || '?'} files aren’t allowed. Allowed: ${DOC_EXTENSIONS.join(', ')}.`;
  }
  if (file.size <= 0) return `${file.name} is empty.`;
  return null;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(Math.round((bytes / (1024 * 1024)) * 10) / 10).toString()} MB`;
}

/** The folders one level under `parentId` (null = top level), by name. */
export const childrenOf = (folders: FolderDto[], parentId: string | null): FolderDto[] =>
  folders
    .filter((f) => f.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

/** Top level → current folder. Empty for the top level. Stops on a cycle so bad data can't hang the UI. */
export function breadcrumb(folders: FolderDto[], folderId: string | null): FolderDto[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const path: FolderDto[] = [];
  const seen = new Set<string>();
  let cur = folderId ? byId.get(folderId) : undefined;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    path.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return path;
}

/** 1 for a top-level folder. */
export const folderDepth = (folders: FolderDto[], folderId: string): number =>
  breadcrumb(folders, folderId).length;

/** The folder and everything under it: a folder can never be moved into itself or its own subtree. */
export function subtreeIds(folders: FolderDto[], folderId: string): Set<string> {
  const out = new Set<string>([folderId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) {
      if (f.parentId && out.has(f.parentId) && !out.has(f.id)) {
        out.add(f.id);
        grew = true;
      }
    }
  }
  return out;
}

export interface FolderOption {
  /** null = the top level. */
  id: string | null;
  label: string;
  depth: number;
}

/**
 * Folders in tree order for a "Move to…" or "Save into…" picker. `blockedId` removes that folder and its
 * subtree; `maxDepth` removes folders that have no room left for what is being placed under them
 * (a moved folder carries its own subtree height).
 */
export function folderOptions(
  folders: FolderDto[],
  opts: { blockedId?: string; extraDepth?: number } = {},
): FolderOption[] {
  const blocked = opts.blockedId ? subtreeIds(folders, opts.blockedId) : new Set<string>();
  const room = MAX_FOLDER_DEPTH - (opts.extraDepth ?? 0);
  const out: FolderOption[] = [{ id: null, label: 'Top level', depth: 0 }];
  const walk = (parent: string | null, depth: number) => {
    for (const f of childrenOf(folders, parent)) {
      if (blocked.has(f.id)) continue;
      if (depth <= room) out.push({ id: f.id, label: f.name, depth });
      walk(f.id, depth + 1);
    }
  };
  walk(null, 1);
  return out;
}

/** How many levels a folder's own subtree adds below it (0 for a leaf). */
export function subtreeHeight(folders: FolderDto[], folderId: string): number {
  const kids = folders.filter((f) => f.parentId === folderId);
  return kids.length === 0 ? 0 : 1 + Math.max(...kids.map((k) => subtreeHeight(folders, k.id)));
}

/** "Saved 3 · 1 already in Docs" */
export function saveSummary(result: SaveResultDto): string {
  const created = result.filter((r) => r.created).length;
  const existing = result.length - created;
  const parts = [`Saved ${created}`];
  if (existing > 0) parts.push(`${existing} already in Docs`);
  return parts.join(' · ');
}

/** Files that belong in the list being shown (name search is applied by the server; this orders them). */
export const sortFiles = (files: DocFileDto[]): DocFileDto[] =>
  [...files].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
