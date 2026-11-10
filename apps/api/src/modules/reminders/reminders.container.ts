import type { Router } from 'express';
import { env } from '@/config/env.js';
import type { IdentityPublicContract } from '@/modules/identity/identity.public.js';
import type { LeadsPublicContract } from '@/modules/leads/leads.public.js';
import type { NotificationsPublicContract } from '@/modules/notifications/notifications.public.js';
import type { ProposalsPublicContract } from '@/modules/proposals/proposals.public.js';
import { RunRemindersUseCase } from './application/usecases/runReminders.usecase.js';
import {
  IdentityAdminDirectory,
  LeadsContractSource,
  NotificationsContractNotifier,
  ProposalsContractSource,
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
  notifications: NotificationsPublicContract;
  identity: IdentityPublicContract;
}

export function buildRemindersContainer(deps: RemindersDeps): RemindersContainer {
  const run = new RunRemindersUseCase(
    new ProposalsContractSource(deps.proposals),
    new LeadsContractSource(deps.leads),
    new NotificationsContractNotifier(deps.notifications),
    new IdentityAdminDirectory(deps.identity),
    {
      unseenDays: env.REMINDER_UNSEEN_DAYS,
      noActionDays: env.REMINDER_NO_ACTION_DAYS,
      stuckDays: env.LEAD_STUCK_DAYS,
      stagnantMax: env.REMINDER_STAGNANT_MAX,
    },
  );

  return {
    contract: { run: () => run.execute() },
    buildRouter: () => buildRemindersRouter(makeRunController(run)),
  };
}
