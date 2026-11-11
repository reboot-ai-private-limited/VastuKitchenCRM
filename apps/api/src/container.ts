import { buildHealthContainer } from '@/modules/health/health.container.js';
import { buildIdentityContainer } from '@/modules/identity/identity.container.js';
import { buildLeadsContainer } from '@/modules/leads/leads.container.js';
import { buildNotificationsContainer } from '@/modules/notifications/notifications.container.js';
import { buildProjectsContainer } from '@/modules/projects/projects.container.js';
import { buildProposalsContainer } from '@/modules/proposals/proposals.container.js';
import { buildSettingsContainer } from '@/modules/settings/settings.container.js';
import { buildRemindersContainer } from '@/modules/reminders/reminders.container.js';
import { createEventBus, type EventBus } from '@/shared/events/appEvents.js';
import { createStorage } from '@/shared/storage/createStorage.js';

/** Top-level composition root. Add each new module's container here and in `AppContainers`. */
export interface AppContainers {
  health: ReturnType<typeof buildHealthContainer>;
  identity: ReturnType<typeof buildIdentityContainer>;
  settings: ReturnType<typeof buildSettingsContainer>;
  notifications: ReturnType<typeof buildNotificationsContainer>;
  leads: ReturnType<typeof buildLeadsContainer>;
  proposals: ReturnType<typeof buildProposalsContainer>;
  projects: ReturnType<typeof buildProjectsContainer>;
  reminders: ReturnType<typeof buildRemindersContainer>;
  /** In-process bus; modules above subscribe to what modules below announce. */
  events: EventBus;
}

export function buildContainers(): AppContainers {
  const events = createEventBus();
  // Built bottom-up, by tier: a module may only be given contracts of modules below it.
  const settings = buildSettingsContainer();
  const identity = buildIdentityContainer();
  const notifications = buildNotificationsContainer();
  const leads = buildLeadsContainer({
    identity: identity.contract,
    settings: settings.contract,
    events,
  });
  const proposals = buildProposalsContainer({
    leads: leads.contract,
    identity: identity.contract,
    settings: settings.contract,
    events,
  });
  const projects = buildProjectsContainer({
    leads: leads.contract,
    proposals: proposals.contract,
    identity: identity.contract,
    notifications: notifications.contract,
    settings: settings.contract,
    storage: createStorage(),
  });
  const reminders = buildRemindersContainer({
    leads: leads.contract,
    proposals: proposals.contract,
    notifications: notifications.contract,
    identity: identity.contract,
    settings: settings.contract,
  });

  return {
    health: buildHealthContainer(),
    settings,
    identity,
    notifications,
    leads,
    proposals,
    projects,
    reminders,
    events,
  };
}
