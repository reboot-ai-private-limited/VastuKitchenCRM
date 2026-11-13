import type { Href } from 'expo-router';
import type { NotificationRefDto, RoleName } from '@vastu/contracts';

const LEAD_ROLES = new Set<RoleName>(['ADMIN', 'SALES', 'OFFICE']);
const PROPOSAL_ROLES = new Set<RoleName>(['ADMIN', 'SALES']);

/**
 * Resolves a notification or dashboard attention `ref` to the right route for the viewer's role
 * (01-personas-and-navigation.md §5). Returns null when the role cannot open the target.
 */
export function routeFor(ref: NotificationRefDto | null, role?: RoleName): Href | null {
  if (!ref) return null;
  const isCustomer = role === 'CUSTOMER';

  switch (ref.kind) {
    case 'LEAD':
      if (role && !LEAD_ROLES.has(role)) return null;
      return { pathname: '/leads/[id]', params: { id: ref.id } } as Href;

    case 'PROPOSAL':
      if (role && !PROPOSAL_ROLES.has(role)) return null;
      return { pathname: '/proposals/[id]', params: { id: ref.id } } as Href;

    case 'PROJECT':
      if (isCustomer) {
        if (ref.fileId) {
          return { pathname: '/docs', params: { projectId: ref.id, file: ref.fileId } } as Href;
        }
        return {
          pathname: '/project',
          params: { projectId: ref.id, ...(ref.postId ? { post: ref.postId } : {}) },
        } as Href;
      }
      return {
        pathname: '/projects/[id]',
        params: {
          id: ref.id,
          ...(ref.postId ? { post: ref.postId } : {}),
          ...(ref.fileId ? { file: ref.fileId } : {}),
        },
      } as Href;

    case 'TODO':
      if (isCustomer) return null;
      return { pathname: '/todos/[id]', params: { id: ref.id } } as Href;

    case 'COMPLAINT':
      return { pathname: '/complaints/[id]', params: { id: ref.id } } as Href;

    default:
      return null;
  }
}
