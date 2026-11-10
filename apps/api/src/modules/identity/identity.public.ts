import type { UserSummary } from './domain/user.entity.js';

export type { UserSummary } from './domain/user.entity.js';

export interface CreatedCustomerInvite {
  token: string;
  url: string;
  expiresAt: Date;
}

/** The only thing another module may import from `identity/`. */
export interface IdentityPublicContract {
  /** Names/roles for ids (assignee dropdowns, feed authors). Unknown ids are simply absent. */
  getUserSummaries(ids: string[]): Promise<UserSummary[]>;
  /** Every active Admin: the fallback recipient when an alert has no one else to go to. */
  getActiveAdminIds(): Promise<string[]>;
  /** Find-or-create the CUSTOMER account for a phone (used when a lead is won). */
  createCustomer(input: { name: string; phone: string }): Promise<UserSummary>;
  createCustomerInvite(customerId: string): Promise<CreatedCustomerInvite>;
}
