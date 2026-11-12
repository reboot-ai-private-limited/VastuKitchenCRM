import type { Router } from 'express';
import type { IdentityPublicContract } from '@/modules/identity/identity.public.js';
import type { LeadsPublicContract } from '@/modules/leads/leads.public.js';
import type { ProjectsPublicContract } from '@/modules/projects/projects.public.js';
import { CustomerViewBuilder } from './application/services/customerViews.js';
import {
  AddCustomerUseCase,
  GetCustomerUseCase,
  ImportCustomersUseCase,
  ListCustomersUseCase,
  StartNewProjectForCustomerUseCase,
} from './application/usecases/customers.usecases.js';
import {
  IdentityGateway,
  LeadsGateway,
  ProjectsGateway,
} from './infrastructure/gateways.adapter.js';
import * as c from './interface/customers.controller.js';
import { buildCustomersRouter } from './interface/customers.route.js';

export interface CustomersContainer {
  /** Mounted at `/api/customers`. */
  buildRouter: () => Router;
}

export interface CustomersDeps {
  /** Other modules' public contracts: the only ways customers reaches them. */
  leads: LeadsPublicContract;
  projects: ProjectsPublicContract;
  identity: IdentityPublicContract;
}

/**
 * A read model over leads, identity and projects: a customer is a person with an account, their
 * lead is their record and timeline, and their projects hang off the account. No data of its own.
 */
export function buildCustomersContainer(deps: CustomersDeps): CustomersContainer {
  const leads = new LeadsGateway(deps.leads);
  const projects = new ProjectsGateway(deps.projects);
  const identity = new IdentityGateway(deps.identity);
  const views = new CustomerViewBuilder(projects, identity);

  return {
    buildRouter: () =>
      buildCustomersRouter({
        list: c.makeList(new ListCustomersUseCase(leads, views)),
        get: c.makeGet(new GetCustomerUseCase(leads, views)),
        add: c.makeAdd(new AddCustomerUseCase(leads, identity, views)),
        importCustomers: c.makeImport(new ImportCustomersUseCase(leads, identity)),
        startNewProject: c.makeStartNewProject(new StartNewProjectForCustomerUseCase(leads, views)),
      }),
  };
}
