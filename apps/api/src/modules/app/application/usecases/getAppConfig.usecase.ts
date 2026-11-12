import type { AppConfigDto, AppPlatform } from '@vastu/contracts';

/** What the use case needs from outside: settings values and the env-only links. */
export interface AppConfigSource {
  versions(platform: AppPlatform): Promise<{ min: string; recommended: string }>;
  maintenance(): Promise<{ active: boolean; message: string }>;
  uploadMaxBytes(): Promise<number>;
  links(platform: AppPlatform): { storeUrl: string | null; apkUrl: string | null };
  polling: { unreadSec: number; chatSec: number };
}

export class GetAppConfigUseCase {
  constructor(private readonly source: AppConfigSource) {}

  async execute(platform: AppPlatform): Promise<AppConfigDto> {
    const [versions, maintenance, uploadMaxBytes] = await Promise.all([
      this.source.versions(platform),
      this.source.maintenance(),
      this.source.uploadMaxBytes(),
    ]);
    return {
      platform,
      minVersion: versions.min,
      recommendedVersion: versions.recommended,
      ...this.source.links(platform),
      maintenance,
      polling: this.source.polling,
      uploadMaxBytes,
    };
  }
}
