import { Suspense } from 'react';
import { AttendanceView } from '@/components/hr/attendance-view';

/** Every staff role may open this: Admin/HR get the board, everyone else their own month. The API is the gate. */
export default function AttendancePage() {
  return (
    <Suspense>
      <AttendanceView />
    </Suspense>
  );
}
