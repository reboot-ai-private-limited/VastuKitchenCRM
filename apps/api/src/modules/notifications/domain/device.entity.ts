import type { RegisterDeviceDto } from '@vastu/contracts';

export interface Device {
  id: string;
  userId: string;
  token: string;
  platform: RegisterDeviceDto['platform'];
  appVersion: string | null;
  deviceName: string | null;
  lastSeenAt: Date;
  createdAt: Date;
}

export type DeviceInput = Pick<Device, 'token' | 'platform' | 'appVersion' | 'deviceName'>;

/** A person may be signed in on a few phones; the oldest beyond this is dropped. */
export const MAX_DEVICES_PER_USER = 5;
