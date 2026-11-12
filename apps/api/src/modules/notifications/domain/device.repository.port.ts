import type { Device, DeviceInput } from './device.entity.js';

export interface DeviceRepositoryPort {
  /** Upsert by token (a token seen under another user moves to this one). Evicts the oldest beyond the cap. */
  register(userId: string, input: DeviceInput, now: Date, maxDevices: number): Promise<Device>;
  /** Removes one of the user's own devices. False when it is not theirs or does not exist. */
  remove(userId: string, id: string): Promise<boolean>;
  /** Removes every device of a user (account deactivated or deleted). Returns how many. */
  removeAllFor(userId: string): Promise<number>;
  tokensFor(userId: string): Promise<string[]>;
  /** Drops tokens the push service says are dead. */
  removeTokens(tokens: string[]): Promise<void>;
}
