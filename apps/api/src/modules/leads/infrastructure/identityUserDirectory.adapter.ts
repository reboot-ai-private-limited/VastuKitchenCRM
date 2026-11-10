import type { IdentityPublicContract } from '@/modules/identity/identity.public.js';
import type {
  CustomerRef,
  DirectoryUser,
  UserDirectoryPort,
} from '../domain/userDirectory.port.js';

/** Leads' only door into identity: its public contract. */
export class IdentityUserDirectory implements UserDirectoryPort {
  constructor(private readonly identity: IdentityPublicContract) {}

  async find(ids: string[]): Promise<DirectoryUser[]> {
    if (ids.length === 0) return [];
    return (await this.identity.getUserSummaries(ids)).map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
    }));
  }

  async ensureCustomer(input: { name: string; phone: string }): Promise<CustomerRef> {
    const customer = await this.identity.createCustomer(input);
    return { id: customer.id };
  }
}
