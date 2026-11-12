import type { CustomerLead, IdentityGatewayPort, ProjectsGatewayPort } from '../../domain/ports.js';

export interface CustomerView {
  lead: CustomerLead;
  owner: { id: string; name: string } | null;
  projects: Array<{
    id: string;
    name: string;
    stage: 'DESIGN' | 'SITE' | 'CLOSED';
    createdAt: Date;
  }>;
  lastActivityAt: Date;
}

/** Puts a customer's lead, owner and projects together: one query each, whatever the page size. */
export class CustomerViewBuilder {
  constructor(
    private readonly projects: ProjectsGatewayPort,
    private readonly identity: IdentityGatewayPort,
  ) {}

  async build(leads: CustomerLead[]): Promise<CustomerView[]> {
    if (leads.length === 0) return [];
    const [projects, owners] = await Promise.all([
      this.projects.forCustomers(leads.map((l) => l.customerId)),
      this.identity.names([
        ...new Set(leads.map((l) => l.assignedToId).filter((x): x is string => !!x)),
      ]),
    ]);
    const ownerById = new Map(owners.map((o) => [o.id, o]));
    return leads.map((lead) => {
      const mine = projects
        .filter((p) => p.customerId === lead.customerId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const newest = mine[0]?.createdAt;
      return {
        lead,
        owner: lead.assignedToId ? (ownerById.get(lead.assignedToId) ?? null) : null,
        projects: mine.map(({ id, name, stage, createdAt }) => ({ id, name, stage, createdAt })),
        lastActivityAt: newest && newest > lead.statusChangedAt ? newest : lead.statusChangedAt,
      };
    });
  }
}
