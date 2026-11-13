import { Redirect } from 'expo-router';
import { landingHrefForRole } from '@/constants/roles';
import { useSession } from '@/lib/auth/session';

/** "/" has no screen of its own: send people to the right home for their role. */
export default function Index() {
  const { status, user } = useSession();
  if (status !== 'signedIn' || !user) {
    return <Redirect href="/login" />;
  }
  return <Redirect href={landingHrefForRole(user.role)} />;
}
