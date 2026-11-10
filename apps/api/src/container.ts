import { buildHealthContainer } from '@/modules/health/health.container.js';
import { buildIdentityContainer } from '@/modules/identity/identity.container.js';
import { buildLeadsContainer } from '@/modules/leads/leads.container.js';
import { buildNotificationsContainer } from '@/modules/notifications/notifications.container.js';
import { buildProposalsContainer } from '@/modules/proposals/proposals.container.js';
import { buildRemindersContainer } from '@/modules/reminders/reminders.container.js';
import { createEventBus, type EventBus } from '@/shared/events/appEvents.js';

/** Top-level composition root. Add each new module's container here and in `AppContainers`. */
export interface AppContainers {
  health: ReturnType<typeof buildHealthContainer>;
  identity: ReturnType<typeof buildIdentityContainer>;
  notifications: ReturnType<typeof buildNotificationsContainer>;
  leads: ReturnType<typeof buildLeadsContainer>;
  proposals: ReturnType<typeof buildProposalsContainer>;
  reminders: ReturnType<typeof buildRemindersContainer>;
  /** In-process bus; modules above subscribe to what modules below announce. */
  events: EventBus;
}

export function buildContainers(): AppContainers {
  const events = createEventBus();
  // Built bottom-up, by tier: a module may only be given contracts of modules below it.
  const identity = buildIdentityContainer();
  const notifications = buildNotificationsContainer();
  const leads = buildLeadsContainer({ identity: identity.contract, events });
  const proposals = buildProposalsContainer({
    leads: leads.contract,
    identity: identity.contract,
    events,
  });
  const reminders = buildRemindersContainer({
    leads: leads.contract,
    proposals: proposals.contract,
    notifications: notifications.contract,
    identity: identity.contract,
  });

  return {
    health: buildHealthContainer(),
    identity,
    notifications,
    leads,
    proposals,
    reminders,
    events,
  };
}
