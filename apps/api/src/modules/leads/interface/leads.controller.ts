import type { Request, RequestHandler } from 'express';
import type { ImportResultDto, LeadActivityDto, PaginatedDto, LeadDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import { asyncHandler } from '@/shared/http/asyncHandler.js';
import { sendSuccess } from '@/shared/http/response.util.js';
import type { Actor } from '../application/services/leadAccess.js';
import type { AssignLeadUseCase } from '../application/usecases/assignLead.usecase.js';
import type { ChangeLeadStatusUseCase } from '../application/usecases/changeLeadStatus.usecase.js';
import type {
  GetCallStatsUseCase,
  ListCallsUseCase,
  RecordCallUseCase,
} from '../application/usecases/calls.usecase.js';
import type { CreateLeadUseCase } from '../application/usecases/createLead.usecase.js';
import type { GetLeadUseCase } from '../application/usecases/getLead.usecase.js';
import type { ImportLeadsUseCase } from '../application/usecases/importLeads.usecase.js';
import type { ListLeadsUseCase } from '../application/usecases/listLeads.usecase.js';
import type { GetLeadTimelineUseCase } from '../application/usecases/timeline.usecase.js';
import type { UpdateLeadUseCase } from '../application/usecases/updateLead.usecase.js';
import type {
  ListVisitsUseCase,
  RecordVisitUseCase,
} from '../application/usecases/visits.usecase.js';
import { toActivityDto, toCallDto, toCallStatDto, toLeadDto, toVisitDto } from './lead.mapper.js';
import type { ListLeadsQueryDto, CallStatsQueryDto } from '@vastu/contracts';

function actorOf(req: Request): Actor {
  if (!req.user) throw AppError.unauthenticated();
  return { id: req.user.sub, role: req.user.role };
}
const idOf = (req: Request): string => String(req.params['id']);

export function makeListLeadsController(useCase: ListLeadsUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    const query = req.query as unknown as ListLeadsQueryDto;
    const { items, total } = await useCase.execute(actorOf(req), query);
    const data: PaginatedDto<LeadDto> = {
      items: items.map(toLeadDto),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
    sendSuccess(req, res, data, 'OK');
  });
}

export function makeCreateLeadController(
  useCase: CreateLeadUseCase,
  get: GetLeadUseCase,
): RequestHandler {
  return asyncHandler(async (req, res) => {
    const actor = actorOf(req);
    const lead = await useCase.execute(actor, req.body);
    sendSuccess(req, res, toLeadDto(await get.execute(actor, lead.id)), 'Lead created.', 201);
  });
}

export function makeGetLeadController(useCase: GetLeadUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    sendSuccess(req, res, toLeadDto(await useCase.execute(actorOf(req), idOf(req))), 'OK');
  });
}

export function makeUpdateLeadController(useCase: UpdateLeadUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      toLeadDto(await useCase.execute(actorOf(req), idOf(req), req.body)),
      'Lead updated.',
    );
  });
}

export function makeAssignLeadController(useCase: AssignLeadUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      toLeadDto(await useCase.execute(actorOf(req), idOf(req), req.body)),
      'Lead assigned.',
    );
  });
}

export function makeChangeStatusController(useCase: ChangeLeadStatusUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      toLeadDto(await useCase.execute(actorOf(req), idOf(req), req.body)),
      'Status updated.',
    );
  });
}

export function makeTimelineController(useCase: GetLeadTimelineUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    const items = await useCase.execute(actorOf(req), idOf(req));
    const data: LeadActivityDto[] = items.map(toActivityDto);
    sendSuccess(req, res, data, 'OK');
  });
}

export function makeRecordCallController(useCase: RecordCallUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    const view = await useCase.execute(actorOf(req), idOf(req), req.body);
    // 201 for a new call, 200 when it was already recorded (the app retried).
    sendSuccess(
      req,
      res,
      toCallDto(view),
      view.created ? 'Call recorded.' : 'Call already recorded.',
      view.created ? 201 : 200,
    );
  });
}

export function makeListCallsController(useCase: ListCallsUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    sendSuccess(req, res, (await useCase.execute(actorOf(req), idOf(req))).map(toCallDto), 'OK');
  });
}

export function makeRecordVisitController(useCase: RecordVisitUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      toVisitDto(await useCase.execute(actorOf(req), idOf(req), req.body)),
      'Visit recorded.',
      201,
    );
  });
}

export function makeListVisitsController(useCase: ListVisitsUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    sendSuccess(req, res, (await useCase.execute(actorOf(req), idOf(req))).map(toVisitDto), 'OK');
  });
}

export function makeCallStatsController(useCase: GetCallStatsUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    const stats = await useCase.execute(req.query as unknown as CallStatsQueryDto);
    sendSuccess(req, res, stats.map(toCallStatDto), 'OK');
  });
}

export function makeImportLeadsController(useCase: ImportLeadsUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    const result: ImportResultDto = await useCase.execute(actorOf(req), req.body);
    sendSuccess(req, res, result, `Imported ${result.created} lead(s).`, 201);
  });
}
