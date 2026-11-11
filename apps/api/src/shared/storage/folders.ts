/**
 * Folder rules. An uploaded asset may only be attached where its folder says it belongs, so a
 * member of project A cannot attach project B's photo or an arbitrary image by guessing an id.
 */
export function projectFolder(root: string, projectId: string): string {
  return `${root}/projects/${projectId}`;
}

/** True only for an id directly inside `folder` (no climbing out with `..`, no nested tricks). */
export function isInFolder(publicId: string, folder: string): boolean {
  if (!publicId.startsWith(`${folder}/`)) return false;
  const name = publicId.slice(folder.length + 1);
  return name.length > 0 && !name.includes('/') && !name.includes('..');
}
