import { NotificationsView } from '@/components/notifications/notifications-view';

/** Every signed-in role has a bell, so there is no role gate: the API returns only the caller's own. */
export default function NotificationsPage() {
  return <NotificationsView />;
}
