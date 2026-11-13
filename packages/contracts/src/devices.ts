import { z } from 'zod';

export const DEVICE_PLATFORMS = ['android', 'ios'] as const;
/** Which push service the token belongs to. Absent means `expo`, the original behaviour. */
export const PUSH_PROVIDERS = ['expo', 'fcm'] as const;

/** Registers (or refreshes) this phone for push. Upserted by token. */
export const registerDeviceSchema = z.object({
  platform: z.enum(DEVICE_PLATFORMS),
  /** An Expo push token (`ExponentPushToken[xxxx]`) or, with `provider: 'fcm'`, a raw FCM token. */
  pushToken: z.string().trim().min(10).max(4096),
  provider: z.enum(PUSH_PROVIDERS).optional(),
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
