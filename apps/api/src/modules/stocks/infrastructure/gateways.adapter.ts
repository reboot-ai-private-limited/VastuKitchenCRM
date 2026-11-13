import type { IdentityPublicContract } from '@/modules/identity/identity.public.js';
import type { DirectoryUser, UserDirectoryPort } from '../domain/ports.js';

/** Stocks' only door into another module: identity's public contract. */
export class IdentityUserDirectory implements UserDirectoryPort {
  constructor(private readonly identity: IdentityPublicContract) {}

  async find(ids: string[]): Promise<DirectoryUser[]> {
    if (ids.length === 0) return [];
    return (await this.identity.getUserSummaries(ids)).map((u) => ({ id: u.id, name: u.name }));
  }
}
