import { buildHealthContainer } from '@/modules/health/health.container.js';
import { buildIdentityContainer } from '@/modules/identity/identity.container.js';
import { buildLeadsContainer } from '@/modules/leads/leads.container.js';
import { buildProposalsContainer } from '@/modules/proposals/proposals.container.js';
import { createEventBus, type EventBus } from '@/shared/events/appEvents.js';

/** Top-level composition root. Add each new module's container here and in `AppContainers`. */
export interface AppContainers {
  health: ReturnType<typeof buildHealthContainer>;
  identity: ReturnType<typeof buildIdentityContainer>;
  leads: ReturnType<typeof buildLeadsContainer>;
  proposals: ReturnType<typeof buildProposalsContainer>;
  /** In-process bus; modules above subscribe to what modules below announce. */
  events: EventBus;
}

export function buildContainers(): AppContainers {
  const events = createEventBus();
  const identity = buildIdentityContainer();
  const leads = buildLeadsContainer({ identity: identity.contract, events });
  return {
    health: buildHealthContainer(),
    identity,
    leads,
    proposals: buildProposalsContainer({
      leads: leads.contract,
      identity: identity.contract,
      events,
    }),
    events,
  };
}
