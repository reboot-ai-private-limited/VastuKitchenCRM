import type { CustomerDto } from '@vastu/contracts';
import type { CustomerView } from '../application/services/customerViews.js';

export const toCustomerDto = (v: CustomerView): CustomerDto => ({
  id: v.lead.customerId,
  name: v.lead.name,
  phone: v.lead.phone,
  city: v.lead.city,
  leadId: v.lead.id,
  leadStatus: v.lead.status,
  owner: v.owner,
  projects: v.projects.map((p) => ({
    id: p.id,
    name: p.name,
    stage: p.stage,
    createdAt: p.createdAt.toISOString(),
  })),
  projectsCount: v.projects.length,
  activeProjects: v.projects.filter((p) => p.stage !== 'CLOSED').length,
  startedAgain: v.lead.status !== 'WON' && v.lead.status !== 'LOST' && v.projects.length > 0,
  lastActivityAt: v.lastActivityAt.toISOString(),
  createdAt: v.lead.createdAt.toISOString(),
});
