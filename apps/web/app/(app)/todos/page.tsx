import { RoleGate } from '@/components/common/role-gate';
import { MyTodosView } from '@/components/todos/my-todos-view';

/** "My assignments": everyone on staff except HR (matches the sidebar in lib/nav.ts). */
export default function TodosPage() {
  return (
    <RoleGate roles={['ADMIN', 'SALES', 'DESIGNER', 'TECHNICIAN', 'OFFICE']}>
      <MyTodosView />
    </RoleGate>
  );
}
