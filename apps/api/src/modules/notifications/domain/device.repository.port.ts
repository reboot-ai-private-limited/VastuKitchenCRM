import type { Device, UpsertDevice } from './device.entity.js';

export interface DeviceRepositoryPort {
  /** One row per token: a token seen under a new user moves to that user (shared phone, re-login). */
  upsertByToken(device: UpsertDevice): Promise<Device>;
  /** Removes one of the user's own devices. False when it is not theirs or does not exist. */
  removeOwn(userId: string, id: string): Promise<boolean>;
  /** The FCM tokens a push for this user should go to. */
  listFcmTokens(userId: string): Promise<string[]>;
  /** Forgets tokens FCM said are dead. */
  removeTokens(tokens: string[]): Promise<void>;
  /** Sign-out / deactivation: the user stops receiving pushes. */
  removeAllForUser(userId: string): Promise<number>;
}
