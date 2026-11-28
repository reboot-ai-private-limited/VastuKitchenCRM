import type {
  AttendanceDayDto,
  AttendanceMonthDto,
  BoardDto,
  CheckInBodyDto,
  RangeDto,
  SetDayBodyDto,
} from '@vastu/contracts';
import { request } from '@/lib/api/client';

export const getMyAttendanceMonth = (month?: string, signal?: AbortSignal) =>
  request<AttendanceMonthDto>(
    'GET',
    `/attendance/me${month ? `?month=${encodeURIComponent(month)}` : ''}`,
    undefined,
    { signal },
  );

export const getUserAttendanceMonth = (userId: string, month?: string, signal?: AbortSignal) =>
  request<AttendanceMonthDto>(
    'GET',
    `/attendance/users/${encodeURIComponent(userId)}${month ? `?month=${encodeURIComponent(month)}` : ''}`,
    undefined,
    { signal },
  );

export const getAttendanceBoard = (date?: string, signal?: AbortSignal) =>
  request<BoardDto>(
    'GET',
    `/attendance/board${date ? `?date=${encodeURIComponent(date)}` : ''}`,
    undefined,
    { signal },
  );

export const getAttendanceRange = (from: string, to: string, signal?: AbortSignal) =>
  request<RangeDto>(
    'GET',
    `/attendance/range?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    undefined,
    { signal },
  );

export const setAttendanceDay = (userId: string, date: string, body: SetDayBodyDto) =>
  request<AttendanceDayDto>(
    'PUT',
    `/attendance/users/${encodeURIComponent(userId)}/days/${encodeURIComponent(date)}`,
    body,
  );

export const removeAttendanceDay = (userId: string, date: string) =>
  request<unknown>(
    'DELETE',
    `/attendance/users/${encodeURIComponent(userId)}/days/${encodeURIComponent(date)}`,
  );

export const checkInAttendance = (body: CheckInBodyDto = {}) =>
  request<AttendanceDayDto>('POST', '/attendance/check-in', body);

export const checkOutAttendance = (body: CheckInBodyDto = {}) =>
  request<AttendanceDayDto>('POST', '/attendance/check-out', body);
