import type { LeadStatus, RoleName } from '@vastu/contracts';

export interface Actor {
  id: string;
  role: RoleName;
}

export interface CustomerLead {
  id: string;
  name: string;
  phone: string;
  city: string | null;
  customerId: string;
  status: LeadStatus;
  statusChangedAt: Date;
  assignedToId: string | null;
  createdAt: Date;
}

/** What customers needs from leads (the adapter wraps leads' public contract). */
export interface LeadsGatewayPort {
  list(
    actor: Actor,
    q: { search?: string; page: number; pageSize: number },
  ): Promise<{ items: CustomerLead[]; total: number }>;
  find(actor: Actor, customerId: string): Promise<CustomerLead>;
  add(
    actor: Actor,
    input: { name: string; phone: string; city: string | null; customerId: string },
  ): Promise<{ lead: CustomerLead; outcome: 'created' | 'linked' | 'existing' }>;
  startNewProject(actor: Actor, customerId: string): Promise<CustomerLead>;
}

export interface ProjectSummary {
  id: string;
  name: string;
  customerId: string;
  stage: 'DESIGN' | 'SITE' | 'CLOSED';
  createdAt: Date;
}

export interface ProjectsGatewayPort {
  forCustomers(customerIds: string[]): Promise<ProjectSummary[]>;
}

export interface IdentityGatewayPort {
  /** Find-or-create the CUSTOMER account for a phone. Throws CONFLICT when the phone is a staff account. */
  ensureCustomer(input: { name: string; phone: string }): Promise<{ id: string }>;
  names(ids: string[]): Promise<Array<{ id: string; name: string }>>;
}
