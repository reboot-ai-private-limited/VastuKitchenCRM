'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { businessDate } from '@/lib/format';
import { clampToToday, currentMonth, isDateString, isFutureMonth, isMonth } from '@/lib/hr';
import { AttendanceBoard } from './attendance-board';
import { AttendanceMonth } from './attendance-month';

/**
 * `/attendance` is three screens in one route, decided by role and the URL:
 * - Admin/HR, no `userId`: the day board (`?date=YYYY-MM-DD`)
 * - Admin/HR with `?userId=…&month=YYYY-MM`: that person's month, with corrections
 * - everyone else on attendance: their own month, read-only (`?month=`)
 */
export function AttendanceView() {
  const { user } = useAuth();
  const params = useSearchParams();
  const admin = user?.role === 'ADMIN' || user?.role === 'HR';
  const view = useMemo(() => {
    const m = params.get('month');
    const month = isMonth(m) && !isFutureMonth(m) ? m : currentMonth();
    const d = params.get('date');
    return {
      month,
      date: isDateString(d) ? clampToToday(d) : businessDate(),
      userId: params.get('userId'),
    };
  }, [params]);

  if (!user) return null;
  if (!admin)
    return (
      <AttendanceMonth
        userId={null}
        month={view.month}
        canEdit={false}
        showAppHint={user.attendanceType === 'GPS'}
      />
    );
  if (view.userId)
    return <AttendanceMonth userId={view.userId} month={view.month} canEdit showAppHint={false} />;
  return <AttendanceBoard date={view.date} />;
}
