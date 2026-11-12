import * as Haptics from 'expo-haptics';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  getAttendanceBoard,
  getMyAttendanceMonth,
  getUserAttendanceMonth,
} from '@/lib/api/endpoints/attendance';
import { businessDate, businessMonth } from '@/lib/format';
import { enqueueOutbox, usePendingOutbox, type AttendancePayload } from '@/offline';
import { getLocationFix, LocationUnavailableError } from './use-location-fix';

export const useMyAttendanceMonth = (month = businessMonth(), enabled = true) =>
  useQuery({
    queryKey: ['attendance', 'me', month],
    queryFn: ({ signal }) => getMyAttendanceMonth(month, signal),
    enabled,
  });

export const useUserAttendanceMonth = (userId: string, month = businessMonth()) =>
  useQuery({
    queryKey: ['attendance', 'user', userId, month],
    queryFn: ({ signal }) => getUserAttendanceMonth(userId, month, signal),
    enabled: !!userId,
  });

export const useAttendanceBoard = (date: string) =>
  useQuery({
    queryKey: ['attendance', 'board', date],
    queryFn: ({ signal }) => getAttendanceBoard(date, signal),
  });

export type PunchInput = { kind: 'in' | 'out'; manual?: boolean };

/**
 * Check in / out: one GPS fix on tap, then the action goes through the offline outbox (sent now
 * if online, otherwise when the connection returns). With no fix and `manual` unset it throws
 * LocationUnavailableError so the card can offer "without location".
 */
export function usePunchAttendance() {
  return useMutation({
    mutationFn: async ({ kind, manual }: PunchInput) => {
      const fix = await getLocationFix();
      if (!fix.ok && !manual) throw new LocationUnavailableError(fix.reason, fix.canAskAgain);
      const payload: AttendancePayload = fix.ok ? { location: fix.location } : {};
      return enqueueOutbox({
        type: kind === 'in' ? 'attendance.checkin' : 'attendance.checkout',
        entityKey: `attendance:${businessDate()}`,
        payload,
      });
    },
    onSuccess: () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    },
  });
}

/** Unsent check-in / check-out, for the "Pending sync" view of the card. */
export function usePendingPunches() {
  const pending = usePendingOutbox((i) => i.type.startsWith('attendance.'));
  return {
    pendingIn: pending.find((i) => i.type === 'attendance.checkin') ?? null,
    pendingOut: pending.find((i) => i.type === 'attendance.checkout') ?? null,
  };
}
