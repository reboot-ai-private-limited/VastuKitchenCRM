import type { Router } from 'express';
import { env } from '@/config/env.js';
import type { IdentityPublicContract } from '@/modules/identity/identity.public.js';
import type { LeadsPublicContract } from '@/modules/leads/leads.public.js';
import type { SettingsPublicContract } from '@/modules/settings/settings.public.js';
import type { EventBus } from '@/shared/events/appEvents.js';
import {
  ProposalAccess,
  ProposalLinks,
  ProposalViewBuilder,
} from './application/services/proposalSupport.js';
import { CreateProposalUseCase } from './application/usecases/createProposal.usecase.js';
import { DuplicateProposalUseCase } from './application/usecases/duplicateProposal.usecase.js';
import {
  GetPublicProposalUseCase,
  RecordProposalSeenUseCase,
} from './application/usecases/publicProposal.usecase.js';
import {
  GetProposalUseCase,
  ListProposalsUseCase,
} from './application/usecases/queries.usecase.js';
import { ProposalReminderQueriesUseCase } from './application/usecases/reminderQueries.usecase.js';
import { SendProposalUseCase } from './application/usecases/sendProposal.usecase.js';
import {
  DeleteProposalUseCase,
  UpdateProposalUseCase,
} from './application/usecases/updateProposal.usecase.js';
import { SettingsGateway } from './infrastructure/settings.adapter.js';
import { AppEventsProposalEvents } from './infrastructure/appEventsProposalEvents.adapter.js';
import { CryptoPublicToken } from './infrastructure/cryptoPublicToken.adapter.js';
import { IdentityUserDirectory } from './infrastructure/identityUserDirectory.adapter.js';
import { LeadsGateway } from './infrastructure/leadsGateway.adapter.js';
import { MongoNumberSequence } from './infrastructure/mongoNumberSequence.adapter.js';
import { MongoProposalInsights } from './infrastructure/mongoInsights.adapter.js';
import { MongoProposalRepository } from './infrastructure/mongoProposal.adapter.js';
import {
  makeCreateController,
  makeDeleteController,
  makeDuplicateController,
  makeGetController,
  makeListController,
  makePublicGetController,
  makePublicSeenController,
  makeSendController,
  makeUpdateController,
} from './interface/proposals.controller.js';
import { buildProposalsRouter, buildPublicProposalsRouter } from './interface/proposals.route.js';
import type { ProposalsPublicContract } from './proposals.public.js';

export interface ProposalsContainer {
  contract: ProposalsPublicContract;
  /** Staff routes, mounted at /api/proposals. */
  buildRouter: () => Router;
  /** No-login customer routes, mounted at /api/public/proposals. */
  buildPublicRouter: () => Router;
}

export interface ProposalsDeps {
  /** Leads' and identity's public contracts: the only ways proposals reaches them. */
  leads: LeadsPublicContract;
  identity: IdentityPublicContract;
  settings: SettingsPublicContract;
  events: EventBus;
}

export function buildProposalsContainer({
  leads,
  identity,
  settings,
  events,
}: ProposalsDeps): ProposalsContainer {
  // 1. Adapters
  const proposals = new MongoProposalRepository();
  const numbers = new MongoNumberSequence();
  const tokens = new CryptoPublicToken();
  const gateway = new LeadsGateway(leads);
  const directory = new IdentityUserDirectory(identity);
  const proposalEvents = new AppEventsProposalEvents(events);
  const proposalSettings = new SettingsGateway(settings);

  // 2. Services and use cases, depending only on ports
  const links = new ProposalLinks(env.WEB_BASE_URL);
  const access = new ProposalAccess(proposals, gateway);
  const views = new ProposalViewBuilder(directory, links);

  const create = new CreateProposalUseCase(proposals, gateway, numbers, tokens, proposalSettings);
  const update = new UpdateProposalUseCase(access, proposals);
  const remove = new DeleteProposalUseCase(access, proposals);
  const get = new GetProposalUseCase(access, views);
  const list = new ListProposalsUseCase(proposals, gateway, views);
  const duplicate = new DuplicateProposalUseCase(access, proposals, gateway, numbers, tokens);
  const send = new SendProposalUseCase(access, proposals, gateway, links, views, proposalSettings);
  const reminderQueries = new ProposalReminderQueriesUseCase(proposals);
  const getPublic = new GetPublicProposalUseCase(proposals, directory, proposalSettings);
  const recordSeen = new RecordProposalSeenUseCase(proposals, gateway, proposalEvents);

  const insights = new MongoProposalInsights();

  return {
    contract: {
      findUnseenSent: (window) => reminderQueries.unseen(window),
      findSeen: (window) => reminderQueries.seen(window),
      activitySummary: (from, to) => insights.activityByUser(from, to),
      latestSentTotals: (leadIds) => insights.latestSentTotals(leadIds),
      getLatestSentTotal: async (leadId) =>
        (await proposals.findLatestSentByLead(leadId))?.total ?? null,
    },
    buildRouter: () =>
      buildProposalsRouter({
        create: makeCreateController(create, views),
        list: makeListController(list),
        get: makeGetController(get),
        update: makeUpdateController(update, views),
        remove: makeDeleteController(remove),
        duplicate: makeDuplicateController(duplicate, views),
        send: makeSendController(send),
      }),
    buildPublicRouter: () =>
      buildPublicProposalsRouter({
        get: makePublicGetController(getPublic),
        seen: makePublicSeenController(recordSeen),
      }),
  };
}
