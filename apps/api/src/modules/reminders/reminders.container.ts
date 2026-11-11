import type { Router } from 'express';
import type { IdentityPublicContract } from '@/modules/identity/identity.public.js';
import type { LeadsPublicContract } from '@/modules/leads/leads.public.js';
import type { NotificationsPublicContract } from '@/modules/notifications/notifications.public.js';
import type { ProposalsPublicContract } from '@/modules/proposals/proposals.public.js';
import type { ComplaintsPublicContract } from '@/modules/complaints/complaints.public.js';
import type { TodosPublicContract } from '@/modules/todos/todos.public.js';
import type { SettingsPublicContract } from '@/modules/settings/settings.public.js';
import { RunRemindersUseCase } from './application/usecases/runReminders.usecase.js';
import {
  ComplaintsContractSource,
  IdentityAdminDirectory,
  LeadsContractSource,
  NotificationsContractNotifier,
  ProposalsContractSource,
  TodosContractSource,
} from './infrastructure/contractSources.adapter.js';
import { makeRunController } from './interface/reminders.controller.js';
import { buildRemindersRouter } from './interface/reminders.route.js';
import type { RemindersPublicContract } from './reminders.public.js';

export interface RemindersContainer {
  contract: RemindersPublicContract;
  buildRouter: () => Router;
}

export interface RemindersDeps {
  /** Other modules' public contracts: the only ways reminders reaches them. */
  leads: LeadsPublicContract;
  proposals: ProposalsPublicContract;
  todos: TodosPublicContract;
  complaints: ComplaintsPublicContract;
  notifications: NotificationsPublicContract;
  identity: IdentityPublicContract;
  settings: SettingsPublicContract;
}

export function buildRemindersContainer(deps: RemindersDeps): RemindersContainer {
  const run = new RunRemindersUseCase(
    new ProposalsContractSource(deps.proposals),
    new LeadsContractSource(deps.leads),
    new TodosContractSource(deps.todos),
    new ComplaintsContractSource(deps.complaints),
    new NotificationsContractNotifier(deps.notifications),
    new IdentityAdminDirectory(deps.identity),
    async () => {
      const [unseenDays, noActionDays, stuckDays, stagnantMax, complaintDays] = await Promise.all([
        deps.settings.get('reminders.unseenDays'),
        deps.settings.get('reminders.noActionDays'),
        deps.settings.get('leads.stuckDays'),
        deps.settings.get('reminders.stagnantMax'),
        deps.settings.get('reminders.complaintDays'),
      ]);
      return { unseenDays, noActionDays, stuckDays, stagnantMax, complaintDays };
    },
  );

  return {
    contract: { run: () => run.execute() },
    buildRouter: () => buildRemindersRouter(makeRunController(run)),
  };
}
