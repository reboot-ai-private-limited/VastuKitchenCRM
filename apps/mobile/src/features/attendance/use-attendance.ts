import * as Haptics from 'expo-haptics';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LocationDto } from '@vastu/contracts';
import {
  checkInAttendance,
  checkOutAttendance,
  getAttendanceBoard,
  getMyAttendanceMonth,
  getUserAttendanceMonth,
} from '@/lib/api/endpoints/attendance';
import { businessMonth } from '@/lib/format';

type GeoGlobal = {
  navigator?: {
    geolocation?: {
      getCurrentPosition: (
        success: (pos: { coords: { latitude: number; longitude: number; accuracy?: number | null } }) => void,
        error: () => void,
        opts?: { enableHighAccuracy?: boolean; timeout?: number; maximumAge?: number },
      ) => void;
    };
  };
};

async function tryGetLocation(): Promise<LocationDto | undefined> {
  const geo = (globalThis as unknown as GeoGlobal).navigator?.geolocation;
  if (!geo?.getCurrentPosition) return undefined;
  return new Promise<LocationDto | undefined>((resolve) => {
    const timer = setTimeout(() => resolve(undefined), 4_000);
    try {
      geo.getCurrentPosition(
        (pos) => {
          clearTimeout(timer);
          const { latitude: lat, longitude: lng, accuracy } = pos.coords;
          resolve({
            lat,
            lng,
            ...(typeof accuracy === 'number' && accuracy >= 0 ? { accuracy } : {}),
          });
        },
        () => {
          clearTimeout(timer);
          resolve(undefined);
        },
        { enableHighAccuracy: true, timeout: 3_500, maximumAge: 30_000 },
      );
    } catch {
      clearTimeout(timer);
      resolve(undefined);
    }
  });
}

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

export function usePunchAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (kind: 'in' | 'out') => {
      const location = await tryGetLocation();
      const body = location ? { location } : {};
      return kind === 'in' ? checkInAttendance(body) : checkOutAttendance(body);
    },
    onSuccess: () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      void qc.invalidateQueries({ queryKey: ['attendance'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
