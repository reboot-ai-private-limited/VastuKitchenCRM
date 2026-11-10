import type { RoleName } from '@vastu/contracts';

export interface DirectoryUser {
  id: string;
  name: string;
  role: RoleName;
}

export interface CustomerRef {
  id: string;
}

/** What leads needs from the identity module (the adapter wraps identity's public contract). */
export interface UserDirectoryPort {
  find(ids: string[]): Promise<DirectoryUser[]>;
  /** Find-or-create the CUSTOMER account for a phone number. */
  ensureCustomer(input: { name: string; phone: string }): Promise<CustomerRef>;
}
