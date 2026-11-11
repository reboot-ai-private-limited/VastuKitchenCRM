import { buildHealthContainer } from '@/modules/health/health.container.js';
import { buildIdentityContainer } from '@/modules/identity/identity.container.js';
import { buildLeadsContainer } from '@/modules/leads/leads.container.js';
import { buildNotificationsContainer } from '@/modules/notifications/notifications.container.js';
import { buildProjectsContainer } from '@/modules/projects/projects.container.js';
import { buildProposalsContainer } from '@/modules/proposals/proposals.container.js';
import { buildSettingsContainer } from '@/modules/settings/settings.container.js';
import { buildComplaintsContainer } from '@/modules/complaints/complaints.container.js';
import { buildDashboardContainer } from '@/modules/dashboard/dashboard.container.js';
import { buildHrContainer } from '@/modules/hr/hr.container.js';
import { buildDocsContainer } from '@/modules/docs/docs.container.js';
import { buildTodosContainer } from '@/modules/todos/todos.container.js';
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
  todos: ReturnType<typeof buildTodosContainer>;
  docs: ReturnType<typeof buildDocsContainer>;
  complaints: ReturnType<typeof buildComplaintsContainer>;
  hr: ReturnType<typeof buildHrContainer>;
  dashboard: ReturnType<typeof buildDashboardContainer>;
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
  const storage = createStorage();
  const projects = buildProjectsContainer({
    leads: leads.contract,
    proposals: proposals.contract,
    identity: identity.contract,
    notifications: notifications.contract,
    settings: settings.contract,
    storage,
  });
  const todos = buildTodosContainer({
    projects: projects.contract,
    identity: identity.contract,
    notifications: notifications.contract,
    storage,
  });
  const docs = buildDocsContainer({
    projects: projects.contract,
    identity: identity.contract,
    notifications: notifications.contract,
    settings: settings.contract,
    storage,
  });
  const complaints = buildComplaintsContainer({
    projects: projects.contract,
    identity: identity.contract,
    notifications: notifications.contract,
    storage,
  });
  const hr = buildHrContainer({ identity: identity.contract, settings: settings.contract });
  const reminders = buildRemindersContainer({
    leads: leads.contract,
    proposals: proposals.contract,
    todos: todos.contract,
    complaints: complaints.contract,
    notifications: notifications.contract,
    identity: identity.contract,
    settings: settings.contract,
  });

  const dashboard = buildDashboardContainer({
    leads: leads.contract,
    proposals: proposals.contract,
    projects: projects.contract,
    complaints: complaints.contract,
    todos: todos.contract,
    hr: hr.contract,
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
    todos,
    docs,
    complaints,
    hr,
    dashboard,
    reminders,
    events,
  };
}
