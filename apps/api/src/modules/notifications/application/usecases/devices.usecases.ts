import type { RegisterDeviceDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import type { Device } from '../../domain/device.entity.js';
import type { DeviceRepositoryPort } from '../../domain/device.repository.port.js';

export class RegisterDeviceUseCase {
  constructor(
    private readonly devices: DeviceRepositoryPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  execute(userId: string, input: RegisterDeviceDto): Promise<Device> {
    return this.devices.upsertByToken({
      userId,
      platform: input.platform,
      // Tokens registered before `provider` existed are Expo tokens.
      provider: input.provider ?? 'expo',
      token: input.pushToken,
      appVersion: input.appVersion ?? null,
      deviceName: input.deviceName ?? null,
      locale: input.locale ?? null,
      lastSeenAt: this.now(),
    });
  }
}

export class RemoveDeviceUseCase {
  constructor(private readonly devices: DeviceRepositoryPort) {}

  async execute(userId: string, id: string): Promise<void> {
    if (!(await this.devices.removeOwn(userId, id))) {
      throw AppError.notFound('Device not found.');
    }
  }
}
