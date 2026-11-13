import { z } from 'zod';

export const DEVICE_PLATFORMS = ['android', 'ios'] as const;

/** Registers (or refreshes) this phone for push. Upserted by token. */
export const registerDeviceSchema = z.object({
  platform: z.enum(DEVICE_PLATFORMS),
  /** The Expo push token, e.g. `ExponentPushToken[xxxx]`. */
  pushToken: z.string().trim().min(10).max(200),
  appVersion: z.string().trim().max(40).optional(),
  deviceName: z.string().trim().max(100).optional(),
  locale: z.string().trim().max(20).optional(),
});
export type RegisterDeviceDto = z.infer<typeof registerDeviceSchema>;

export const deviceSchema = z.object({
  id: z.string(),
  platform: z.enum(DEVICE_PLATFORMS),
  appVersion: z.string().nullable(),
  deviceName: z.string().nullable(),
  lastSeenAt: z.string(),
  createdAt: z.string(),
});
export type DeviceDto = z.infer<typeof deviceSchema>;

export const deviceIdParamsSchema = z.object({ id: z.string().min(1) });
