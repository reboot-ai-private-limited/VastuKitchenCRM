import type { Router } from 'express';
import type { IdentityPublicContract } from '@/modules/identity/identity.public.js';
import type { SettingsPublicContract } from '@/modules/settings/settings.public.js';
import type { EventBus } from '@/shared/events/appEvents.js';
import { LeadAccess } from './application/services/leadAccess.js';
import { LeadViewBuilder } from './application/services/leadViews.js';
import { AssignLeadUseCase } from './application/usecases/assignLead.usecase.js';
import { ChangeLeadStatusUseCase } from './application/usecases/changeLeadStatus.usecase.js';
import {
  GetCallStatsUseCase,
  ListCallsUseCase,
  RecordCallUseCase,
} from './application/usecases/calls.usecase.js';
import { CreateLeadUseCase } from './application/usecases/createLead.usecase.js';
import { GetLeadUseCase } from './application/usecases/getLead.usecase.js';
import { ImportLeadsUseCase } from './application/usecases/importLeads.usecase.js';
import {
  GetLeadJourneyUseCase,
  RecordProjectEventUseCase,
} from './application/usecases/projectHooks.usecase.js';
import { ReminderQueriesUseCase } from './application/usecases/reminderQueries.usecase.js';
import { ListLeadsUseCase } from './application/usecases/listLeads.usecase.js';
import { GetLeadTimelineUseCase } from './application/usecases/timeline.usecase.js';
import {
  GetLeadForProposalUseCase,
  RecordProposalSeenUseCase,
  RecordProposalSentUseCase,
} from './application/usecases/proposalHooks.usecase.js';
import { UpdateLeadUseCase } from './application/usecases/updateLead.usecase.js';
import { ListVisitsUseCase, RecordVisitUseCase } from './application/usecases/visits.usecase.js';
import { AppEventsLeadEvents } from './infrastructure/appEventsLeadEvents.adapter.js';
import { IdentityUserDirectory } from './infrastructure/identityUserDirectory.adapter.js';
import { MongoLeadInsights } from './infrastructure/mongoInsights.adapter.js';
import { MongoCallRepository } from './infrastructure/mongoCall.adapter.js';
import { MongoLeadActivityRepository } from './infrastructure/mongoLeadActivity.adapter.js';
import { MongoLeadRepository } from './infrastructure/mongoLead.adapter.js';
import { MongoVisitRepository } from './infrastructure/mongoVisit.adapter.js';
import {
  makeAssignLeadController,
  makeCallStatsController,
  makeChangeStatusController,
  makeCreateLeadController,
  makeGetLeadController,
  makeImportLeadsController,
  makeListCallsController,
  makeListLeadsController,
  makeListVisitsController,
  makeRecordCallController,
  makeRecordVisitController,
  makeTimelineController,
  makeUpdateLeadController,
} from './interface/leads.controller.js';
import { buildLeadsRouter } from './interface/leads.route.js';
import type { LeadsPublicContract } from './leads.public.js';

export interface LeadsContainer {
  contract: LeadsPublicContract;
  buildRouter: () => Router;
}

export interface LeadsDeps {
  /** Identity's public contract: the only way leads reaches users. */
  identity: IdentityPublicContract;
  /** Where the "stuck after N days" value lives (Admin-editable). */
  settings: SettingsPublicContract;
  events: EventBus;
}

export function buildLeadsContainer({ identity, settings, events }: LeadsDeps): LeadsContainer {
  // 1. Adapters
  const leads = new MongoLeadRepository();
  const calls = new MongoCallRepository();
  const visits = new MongoVisitRepository();
  const activities = new MongoLeadActivityRepository();
  const directory = new IdentityUserDirectory(identity);
  const leadEvents = new AppEventsLeadEvents(events);

  // 2. Shared services and use cases, depending only on ports
  const access = new LeadAccess(leads);
  const stuckDays = () => settings.get('leads.stuckDays');
  const views = new LeadViewBuilder(directory, stuckDays);
  const getLead = new GetLeadUseCase(access, views);
  const createLead = new CreateLeadUseCase(leads, activities);
  const listLeads = new ListLeadsUseCase(leads, views, stuckDays);
  const updateLead = new UpdateLeadUseCase(access, leads, views);
  const assignLead = new AssignLeadUseCase(leads, activities, directory, leadEvents, views);
  const changeStatus = new ChangeLeadStatusUseCase(
    access,
    leads,
    activities,
    directory,
    leadEvents,
    views,
  );
  const timeline = new GetLeadTimelineUseCase(access, activities, directory);
  const recordCall = new RecordCallUseCase(access, calls, leads, activities, directory);
  const listCalls = new ListCallsUseCase(access, calls, directory);
  const callStats = new GetCallStatsUseCase(calls, directory);
  const insights = new MongoLeadInsights();
  const recordVisit = new RecordVisitUseCase(access, visits, activities, directory);
  const listVisits = new ListVisitsUseCase(access, visits, directory);
  const importLeads = new ImportLeadsUseCase(leads, activities);
  const reminderQueries = new ReminderQueriesUseCase(leads);
  const recordProjectEvent = new RecordProjectEventUseCase(activities);
  const getLeadJourney = new GetLeadJourneyUseCase(access, activities, directory);
  const getLeadForProposal = new GetLeadForProposalUseCase(access);
  const recordProposalSent = new RecordProposalSentUseCase(access, leads, activities);
  const recordProposalSeen = new RecordProposalSeenUseCase(activities);

  return {
    contract: {
      callStats: (from, to) => calls.statsByUser(from, to),
      dashboardCounts: async (from, to) => ({
        byStatus: await insights.countsByStatus(),
        createdInRange: await insights.createdBetween(from, to),
      }),
      activitySummary: (from, to) => insights.activityByUser(from, to),
      openLeadIds: (limit) => insights.openLeadIds(limit),
      wonLeadIds: (from, to, limit) => insights.wonLeadIds(from, to, limit),
      getLeadStates: (ids) => reminderQueries.states(ids),
      findStuckLeads: (query) => reminderQueries.findStuck(query),
      getLeadForProposal: (actor, leadId) => getLeadForProposal.execute(actor, leadId),
      recordProposalSent: (actor, leadId, info) => recordProposalSent.execute(actor, leadId, info),
      recordProposalSeen: (leadId, info) => recordProposalSeen.execute(leadId, info),
      recordProjectEvent: (leadId, event) => recordProjectEvent.execute(leadId, event),
      getLeadJourney: (actor, leadId) => getLeadJourney.execute(actor, leadId),
    },
    buildRouter: () =>
      buildLeadsRouter({
        list: makeListLeadsController(listLeads),
        create: makeCreateLeadController(createLead, getLead),
        importLeads: makeImportLeadsController(importLeads),
        callStats: makeCallStatsController(callStats),
        get: makeGetLeadController(getLead),
        update: makeUpdateLeadController(updateLead),
        assign: makeAssignLeadController(assignLead),
        changeStatus: makeChangeStatusController(changeStatus),
        timeline: makeTimelineController(timeline),
        recordCall: makeRecordCallController(recordCall),
        listCalls: makeListCallsController(listCalls),
        recordVisit: makeRecordVisitController(recordVisit),
        listVisits: makeListVisitsController(listVisits),
      }),
  };
}
