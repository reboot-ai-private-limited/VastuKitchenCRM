import type { IdentityPublicContract } from '@/modules/identity/identity.public.js';
import type { LeadsPublicContract } from '@/modules/leads/leads.public.js';
import type { ProjectsPublicContract } from '@/modules/projects/projects.public.js';
import type {
  Actor,
  IdentityGatewayPort,
  LeadsGatewayPort,
  ProjectsGatewayPort,
} from '../domain/ports.js';

/** Customers' only doors into other modules: their public contracts. */
export class LeadsGateway implements LeadsGatewayPort {
  constructor(private readonly leads: LeadsPublicContract) {}
  list = (actor: Actor, q: { search?: string; page: number; pageSize: number }) =>
    this.leads.listCustomerLeads(actor, q);
  find = (actor: Actor, customerId: string) => this.leads.findCustomerLead(actor, customerId);
  add = (
    actor: Actor,
    input: { name: string; phone: string; city: string | null; customerId: string },
  ) => this.leads.addCustomerLead(actor, input);
  startNewProject = (actor: Actor, customerId: string) =>
    this.leads.startNewProject(actor, customerId);
}

export class ProjectsGateway implements ProjectsGatewayPort {
  constructor(private readonly projects: ProjectsPublicContract) {}
  forCustomers = (customerIds: string[]) => this.projects.getCustomerProjects(customerIds);
}

export class IdentityGateway implements IdentityGatewayPort {
  constructor(private readonly identity: IdentityPublicContract) {}
  ensureCustomer = async (input: { name: string; phone: string }) => ({
    id: (await this.identity.createCustomer(input)).id,
  });
  names = async (ids: string[]) =>
    (await this.identity.getUserSummaries(ids)).map((u) => ({ id: u.id, name: u.name }));
}
