import type { SettingsPublicContract } from '@/modules/settings/settings.public.js';
import type { CompanyProfile, ProposalSettingsPort } from '../domain/settings.port.js';

/** Proposals' only door into settings: its public contract. */
export class SettingsGateway implements ProposalSettingsPort {
  constructor(private readonly settings: SettingsPublicContract) {}

  defaultTerms(): Promise<string> {
    return this.settings.get('proposals.defaultTerms');
  }

  async company(): Promise<CompanyProfile> {
    const [name, tagline, address, phone] = await Promise.all([
      this.settings.get('company.name'),
      this.settings.get('company.tagline'),
      this.settings.get('company.address'),
      this.settings.get('company.phone'),
    ]);
    return { name, tagline, address, phone };
  }
}
