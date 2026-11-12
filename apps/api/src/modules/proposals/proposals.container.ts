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
import { SendProposalWhatsappUseCase } from './application/usecases/sendProposalWhatsapp.usecase.js';
import {
  UnconfiguredProposalMessenger,
  WaAgentProposalMessenger,
} from './infrastructure/waAgentProposalMessenger.adapter.js';
import { WaAgentClient } from '@/shared/whatsapp/waAgentClient.js';
import {
  DeleteProposalUseCase,
  UpdateProposalUseCase,
} from './application/usecases/updateProposal.usecase.js';
import { TemplateResolver } from './application/services/templateResolver.js';
import {
  CreateTemplateUseCase,
  DeleteTemplateUseCase,
  DuplicateTemplateUseCase,
  GetTemplateUseCase,
  ListTemplatesUseCase,
  UpdateTemplateUseCase,
} from './application/usecases/templates.usecase.js';
import { MongoProposalTemplateStore } from './infrastructure/mongoProposalTemplate.adapter.js';
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
  makeSendWhatsappController,
  makeUpdateController,
} from './interface/proposals.controller.js';
import { makeTemplateControllers } from './interface/templates.controller.js';
import { buildTemplatesRouter } from './interface/templates.route.js';
import { buildProposalsRouter, buildPublicProposalsRouter } from './interface/proposals.route.js';
import type { ProposalsPublicContract } from './proposals.public.js';

export interface ProposalsContainer {
  contract: ProposalsPublicContract;
  /** Staff routes, mounted at /api/proposals. */
  buildRouter: () => Router;
  /** Template gallery and editor routes, mounted at /api/proposal-templates. */
  buildTemplatesRouter: () => Router;
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
  const templateStore = new MongoProposalTemplateStore();

  // 2. Services and use cases, depending only on ports
  const links = new ProposalLinks(env.WEB_BASE_URL);
  const access = new ProposalAccess(proposals, gateway);
  const views = new ProposalViewBuilder(directory, links);
  const templates = new TemplateResolver(templateStore);

  const create = new CreateProposalUseCase(
    proposals,
    gateway,
    numbers,
    tokens,
    proposalSettings,
    templates,
  );
  const update = new UpdateProposalUseCase(access, proposals, templates);
  const remove = new DeleteProposalUseCase(access, proposals);
  const get = new GetProposalUseCase(access, views);
  const list = new ListProposalsUseCase(proposals, gateway, views);
  const duplicate = new DuplicateProposalUseCase(access, proposals, gateway, numbers, tokens);
  const send = new SendProposalUseCase(access, proposals, gateway, links, views, proposalSettings);
  const proposalTemplate = env.WA_AGENT_PROPOSAL_TEMPLATE_ID
    ? { id: env.WA_AGENT_PROPOSAL_TEMPLATE_ID }
    : env.WA_AGENT_PROPOSAL_TEMPLATE
      ? { name: env.WA_AGENT_PROPOSAL_TEMPLATE, language: env.WA_AGENT_PROPOSAL_LANGUAGE }
      : null;
  const messenger =
    env.WA_AGENT_API_KEY && env.WA_AGENT_PHONE_NUMBER_ID && proposalTemplate
      ? new WaAgentProposalMessenger(
          new WaAgentClient({
            apiKey: env.WA_AGENT_API_KEY,
            phoneNumberId: env.WA_AGENT_PHONE_NUMBER_ID,
            baseUrl: env.WA_AGENT_BASE_URL,
          }),
          proposalTemplate,
        )
      : new UnconfiguredProposalMessenger();
  const sendWhatsapp = new SendProposalWhatsappUseCase(
    send,
    proposals,
    messenger,
    proposalSettings,
    views,
  );
  const reminderQueries = new ProposalReminderQueriesUseCase(proposals);
  const getPublic = new GetPublicProposalUseCase(proposals, directory, proposalSettings);
  const recordSeen = new RecordProposalSeenUseCase(proposals, gateway, proposalEvents);

  const templateControllers = makeTemplateControllers({
    list: new ListTemplatesUseCase(templateStore),
    get: new GetTemplateUseCase(templates),
    create: new CreateTemplateUseCase(templateStore),
    update: new UpdateTemplateUseCase(templateStore, templates),
    remove: new DeleteTemplateUseCase(templateStore, templates),
    duplicate: new DuplicateTemplateUseCase(templateStore, templates),
  });

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
        sendWhatsapp: makeSendWhatsappController(sendWhatsapp),
      }),
    buildTemplatesRouter: () => buildTemplatesRouter(templateControllers),
    buildPublicRouter: () =>
      buildPublicProposalsRouter({
        get: makePublicGetController(getPublic),
        seen: makePublicSeenController(recordSeen),
      }),
  };
}
