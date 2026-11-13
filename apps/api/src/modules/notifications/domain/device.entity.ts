import type { DEVICE_PLATFORMS, PUSH_PROVIDERS } from '@vastu/contracts';

export interface Device {
  id: string;
  userId: string;
  platform: (typeof DEVICE_PLATFORMS)[number];
  provider: (typeof PUSH_PROVIDERS)[number];
  token: string;
  appVersion: string | null;
  deviceName: string | null;
  locale: string | null;
  lastSeenAt: Date;
  createdAt: Date;
}

export type UpsertDevice = Omit<Device, 'id' | 'createdAt'>;
