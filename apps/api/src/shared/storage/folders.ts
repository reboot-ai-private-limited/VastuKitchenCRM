/**
 * Folder rules. An uploaded asset may only be attached where its folder says it belongs, so a
 * member of project A cannot attach project B's photo or an arbitrary image by guessing an id.
 */
export function projectFolder(root: string, projectId: string): string {
  return `${root}/projects/${projectId}`;
}

/**
 * Where a project's DOCUMENTS are uploaded. A sibling of the photo folder, not inside it as far as
 * `isInFolder` is concerned (that only accepts direct children), so a photo id can never pass for
 * a document upload, nor the other way round.
 */
export function projectFilesFolder(root: string, projectId: string): string {
  return `${root}/projects/${projectId}/files`;
}

/** Where a lead's visit photos are uploaded. */
export function leadVisitFolder(root: string, leadId: string): string {
  return `${root}/leads/${leadId}/visits`;
}

/** True only for an id directly inside `folder` (no climbing out with `..`, no nested tricks). */
export function isInFolder(publicId: string, folder: string): boolean {
  if (!publicId.startsWith(`${folder}/`)) return false;
  const name = publicId.slice(folder.length + 1);
  return name.length > 0 && !name.includes('/') && !name.includes('..');
}
