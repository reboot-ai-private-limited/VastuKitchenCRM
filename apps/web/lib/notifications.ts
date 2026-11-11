import type { NotificationRefDto } from '@vastu/contracts';

/** Where a notification leads (docs/05-design/api-map.md §10). Unknown kinds go to the dashboard. */
export function refHref(ref: NotificationRefDto | null): string {
  if (!ref) return '/';
  const q = (params: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    const s = sp.toString();
    return s ? `?${s}` : '';
  };
  switch (ref.kind) {
    case 'LEAD':
      return `/leads/${ref.id}`;
    case 'PROPOSAL':
      return `/proposals/${ref.id}`;
    case 'PROJECT':
      return `/projects/${ref.id}${q({ post: ref.postId, file: ref.fileId, tab: ref.fileId ? 'docs' : undefined })}`;
    case 'TODO':
      return ref.projectId
        ? `/projects/${ref.projectId}${q({ tab: 'todos', todo: ref.id })}`
        : '/todos';
    case 'COMPLAINT':
      return `/complaints/${ref.id}`;
    default:
      return '/';
  }
}

export type NotificationGroup = 'lead' | 'proposal' | 'project' | 'todo' | 'file' | 'complaint';

export function groupOf(type: string): NotificationGroup {
  if (type.startsWith('PROPOSAL_')) return 'proposal';
  if (type.startsWith('PROJECT_')) return 'project';
  if (type.startsWith('TODO_')) return 'todo';
  if (type.startsWith('FILE_')) return 'file';
  if (type.startsWith('COMPLAINT_')) return 'complaint';
  return 'lead';
}
