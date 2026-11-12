import type { Request, RequestHandler } from 'express';
import type {
  PaginatedDto,
  ProposalDto,
  SendProposalResponseDto,
  ListProposalsQueryDto,
} from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import { asyncHandler } from '@/shared/http/asyncHandler.js';
import { sendSuccess } from '@/shared/http/response.util.js';
import type { ActorRef } from '../domain/leadsGateway.port.js';
import type { CreateProposalUseCase } from '../application/usecases/createProposal.usecase.js';
import type { DuplicateProposalUseCase } from '../application/usecases/duplicateProposal.usecase.js';
import type {
  GetProposalUseCase,
  ListProposalsUseCase,
} from '../application/usecases/queries.usecase.js';
import type {
  GetPublicProposalUseCase,
  RecordProposalSeenUseCase,
} from '../application/usecases/publicProposal.usecase.js';
import type { SendProposalUseCase } from '../application/usecases/sendProposal.usecase.js';
import type {
  DeleteProposalUseCase,
  UpdateProposalUseCase,
} from '../application/usecases/updateProposal.usecase.js';
import type { ProposalViewBuilder } from '../application/services/proposalSupport.js';
import { toProposalDto, toPublicProposalDto } from './proposal.mapper.js';

function actorOf(req: Request): ActorRef {
  if (!req.user) throw AppError.unauthenticated();
  return { id: req.user.sub, role: req.user.role };
}
const idOf = (req: Request): string => String(req.params['id']);
const tokenOf = (req: Request): string => String(req.params['token']);

export function makeCreateController(
  useCase: CreateProposalUseCase,
  views: ProposalViewBuilder,
): RequestHandler {
  return asyncHandler(async (req, res) => {
    const proposal = await useCase.execute(actorOf(req), req.body);
    const [view] = await views.build([proposal]);
    sendSuccess(req, res, toProposalDto(view!), 'Draft created.', 201);
  });
}

export function makeListController(useCase: ListProposalsUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    const query = req.query as unknown as ListProposalsQueryDto;
    const { items, total } = await useCase.execute(actorOf(req), query);
    const data: PaginatedDto<ProposalDto> = {
      items: items.map(toProposalDto),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
    sendSuccess(req, res, data, 'OK');
  });
}

export function makeGetController(useCase: GetProposalUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    sendSuccess(req, res, toProposalDto(await useCase.execute(actorOf(req), idOf(req))), 'OK');
  });
}

export function makeUpdateController(
  useCase: UpdateProposalUseCase,
  views: ProposalViewBuilder,
): RequestHandler {
  return asyncHandler(async (req, res) => {
    const proposal = await useCase.execute(actorOf(req), idOf(req), req.body);
    const [view] = await views.build([proposal]);
    sendSuccess(req, res, toProposalDto(view!), 'Draft updated.');
  });
}

export function makeDeleteController(useCase: DeleteProposalUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    await useCase.execute(actorOf(req), idOf(req));
    sendSuccess(req, res, {}, 'Draft deleted.');
  });
}

export function makeDuplicateController(
  useCase: DuplicateProposalUseCase,
  views: ProposalViewBuilder,
): RequestHandler {
  return asyncHandler(async (req, res) => {
    const proposal = await useCase.execute(actorOf(req), idOf(req));
    const [view] = await views.build([proposal]);
    sendSuccess(req, res, toProposalDto(view!), 'Draft created from the earlier proposal.', 201);
  });
}

export function makeSendController(useCase: SendProposalUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    const result = await useCase.execute(actorOf(req), idOf(req));
    const data: SendProposalResponseDto = {
      proposal: toProposalDto(result.view),
      publicUrl: result.publicUrl,
      whatsappUrl: result.whatsappUrl,
    };
    sendSuccess(req, res, data, 'Proposal ready to send.');
  });
}

/** Public. `no-store`: a cached copy would hide edits and, worse, hide the seen tracking. */
export function makePublicGetController(useCase: GetPublicProposalUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    const view = await useCase.execute(tokenOf(req));
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    sendSuccess(req, res, toPublicProposalDto(view), 'OK');
  });
}

/** Public. Always answers the same, whether or not the view was counted or the token exists. */
export function makePublicSeenController(useCase: RecordProposalSeenUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    await useCase.execute(
      tokenOf(req),
      req.headers['user-agent'],
      req.user ? { id: req.user.sub, role: req.user.role } : undefined,
    );
    res.setHeader('Cache-Control', 'no-store');
    sendSuccess(req, res, {}, 'OK');
  });
}
