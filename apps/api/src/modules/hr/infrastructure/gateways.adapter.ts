import type { IdentityPublicContract } from '@/modules/identity/identity.public.js';
import type { SettingsPublicContract } from '@/modules/settings/settings.public.js';
import type { HrSettingsPort, StaffDirectoryPort, StaffRecord } from '../domain/ports.js';

/** HR's only doors into the other modules: their public contracts. */

export class IdentityStaffDirectory implements StaffDirectoryPort {
  constructor(private readonly identity: IdentityPublicContract) {}

  all(): Promise<StaffRecord[]> {
    return this.identity.getStaff();
  }
}

export class SettingsGateway implements HrSettingsPort {
  constructor(private readonly settings: SettingsPublicContract) {}

  weeklyOff(): Promise<string> {
    return this.settings.get('hr.weeklyOff');
  }
}
