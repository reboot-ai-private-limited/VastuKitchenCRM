import type { Router } from 'express';
import { env } from '@/config/env.js';
import type { ComplaintsPublicContract } from '@/modules/complaints/complaints.public.js';
import type { HrPublicContract } from '@/modules/hr/hr.public.js';
import type { IdentityPublicContract } from '@/modules/identity/identity.public.js';
import type { LeadsPublicContract } from '@/modules/leads/leads.public.js';
import type { ProjectsPublicContract } from '@/modules/projects/projects.public.js';
import type { ProposalsPublicContract } from '@/modules/proposals/proposals.public.js';
import type { SettingsPublicContract } from '@/modules/settings/settings.public.js';
import type { TodosPublicContract } from '@/modules/todos/todos.public.js';
import { createBusinessClock } from '@/shared/time/businessClock.js';
import { GetDashboardUseCase } from './application/usecases/getDashboard.usecase.js';
import { makeGetDashboard } from './interface/dashboard.controller.js';
import { buildDashboardRouter } from './interface/dashboard.route.js';
import type { DashboardPublicContract } from './dashboard.public.js';

export interface DashboardContainer {
  contract: DashboardPublicContract;
  /** Mounted at `/api/dashboard`. */
  buildRouter: () => Router;
}

export interface DashboardDeps {
  /** Other modules' public contracts: the only ways the dashboard reaches them. */
  leads: LeadsPublicContract;
  proposals: ProposalsPublicContract;
  projects: ProjectsPublicContract;
  complaints: ComplaintsPublicContract;
  todos: TodosPublicContract;
  hr: HrPublicContract;
  identity: IdentityPublicContract;
  settings: SettingsPublicContract;
}

export function buildDashboardContainer(deps: DashboardDeps): DashboardContainer {
  const get = new GetDashboardUseCase(
    {
      leads: deps.leads,
      proposals: deps.proposals,
      projects: deps.projects,
      complaints: deps.complaints,
      todos: deps.todos,
      hr: deps.hr,
      directory: deps.identity,
      // Read on every request, so an Admin's change to a threshold shows on the next refresh.
      thresholds: {
        load: async () => {
          const [unseenDays, noActionDays, stuckDays, complaintDays] = await Promise.all([
            deps.settings.get('reminders.unseenDays'),
            deps.settings.get('reminders.noActionDays'),
            deps.settings.get('leads.stuckDays'),
            deps.settings.get('reminders.complaintDays'),
          ]);
          return { unseenDays, noActionDays, stuckDays, complaintDays };
        },
      },
    },
    createBusinessClock(env.BUSINESS_TIMEZONE),
  );

  return { contract: {}, buildRouter: () => buildDashboardRouter(makeGetDashboard(get)) };
}
