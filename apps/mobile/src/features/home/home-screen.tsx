import { Redirect, type Href } from 'expo-router';
import { useSession } from '@/lib/auth/session';
import { AdminGlanceHome } from './admin-glance-home';
import { DesignerTodayHome } from './designer-today-home';
import { HrBoardHome } from './hr-board-home';
import { OfficeTodayHome } from './office-today-home';
import { SalesTodayHome } from './sales-today-home';
import { TechnicianTodayHome } from './technician-today-home';

/**
 * Role-specific staff Home switcher (01-personas-and-navigation.md §1–2).
 * Customers use their own 3-tab `(customer)` shell and are redirected if they ever land here.
 */
export function HomeScreen() {
  const { user } = useSession();

  if (!user) return null;

  switch (user.role) {
    case 'ADMIN':
      return <AdminGlanceHome />;
    case 'HR':
      return <HrBoardHome />;
    case 'SALES':
      return <SalesTodayHome />;
    case 'DESIGNER':
      return <DesignerTodayHome />;
    case 'TECHNICIAN':
      return <TechnicianTodayHome />;
    case 'OFFICE':
      return <OfficeTodayHome />;
    case 'CUSTOMER':
      return <Redirect href={'/project' as Href} />;
  }
}
