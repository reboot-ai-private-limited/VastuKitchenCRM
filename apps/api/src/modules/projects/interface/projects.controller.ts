import type { Request, RequestHandler } from 'express';
import type {
  ListPostsQueryDto,
  ListProjectsQueryDto,
  PaginatedDto,
  PostPageDto,
  ProjectDto,
} from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import { asyncHandler } from '@/shared/http/asyncHandler.js';
import { sendSuccess } from '@/shared/http/response.util.js';
import type { ActorRef } from '../domain/ports.js';
import type {
  ApprovePostUseCase,
  CreateCommentUseCase,
  CreatePostUseCase,
  DeleteCommentUseCase,
  DeletePostUseCase,
  GetJourneyUseCase,
  ListCommentsUseCase,
  ListPostsUseCase,
  SignUploadUseCase,
} from '../application/usecases/feed.usecases.js';
import type {
  ChangeDesignStageUseCase,
  ChangeStageUseCase,
  CloseProjectUseCase,
  CreateProjectUseCase,
  GetProjectUseCase,
  ListProjectsUseCase,
  SetMembersUseCase,
  UpdateProjectUseCase,
} from '../application/usecases/projects.usecases.js';
import { toCommentDto, toJourneyDto, toPostDto, toProjectDto } from './projects.mapper.js';

function actorOf(req: Request): ActorRef {
  if (!req.user) throw AppError.unauthenticated();
  return { id: req.user.sub, role: req.user.role };
}
const p = (req: Request, name: string): string => String(req.params[name]);

export const makeCreateProject = (uc: CreateProjectUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      toProjectDto(await uc.execute(actorOf(req), req.body)),
      'Project created.',
      201,
    );
  });

export const makeListProjects = (uc: ListProjectsUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as ListProjectsQueryDto;
    const { items, total } = await uc.execute(actorOf(req), query);
    const data: PaginatedDto<ProjectDto> = {
      items: items.map(toProjectDto),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
    sendSuccess(req, res, data, 'OK');
  });

export const makeGetProject = (uc: GetProjectUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(req, res, toProjectDto(await uc.execute(actorOf(req), p(req, 'id'))), 'OK');
  });

export const makeUpdateProject = (uc: UpdateProjectUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      toProjectDto(await uc.execute(actorOf(req), p(req, 'id'), req.body)),
      'Project updated.',
    );
  });

export const makeSetMembers = (uc: SetMembersUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      toProjectDto(await uc.execute(actorOf(req), p(req, 'id'), req.body)),
      'Members updated.',
    );
  });

export const makeChangeStage = (uc: ChangeStageUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      toProjectDto(await uc.execute(actorOf(req), p(req, 'id'), req.body.stage)),
      'Stage updated.',
    );
  });

export const makeChangeDesignStage = (uc: ChangeDesignStageUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      toProjectDto(await uc.execute(actorOf(req), p(req, 'id'), req.body.designStage)),
      'Design stage updated.',
    );
  });

export const makeCloseProject = (uc: CloseProjectUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      toProjectDto(await uc.execute(actorOf(req), p(req, 'id'))),
      'Project closed.',
    );
  });

export const makeJourney = (uc: GetJourneyUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(req, res, (await uc.execute(actorOf(req), p(req, 'id'))).map(toJourneyDto), 'OK');
  });

export const makeSignUpload = (uc: SignUploadUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    // A signed ticket: never cached by anything between the API and the app.
    res.setHeader('Cache-Control', 'no-store');
    sendSuccess(req, res, await uc.execute(actorOf(req), p(req, 'id')), 'Upload ticket ready.');
  });

export const makeListPosts = (uc: ListPostsUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    const { items, nextCursor } = await uc.execute(
      actorOf(req),
      p(req, 'id'),
      req.query as unknown as ListPostsQueryDto,
    );
    const data: PostPageDto = { items: items.map(toPostDto), nextCursor };
    sendSuccess(req, res, data, 'OK');
  });

export const makeCreatePost = (uc: CreatePostUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      toPostDto(await uc.execute(actorOf(req), p(req, 'id'), req.body)),
      'Posted.',
      201,
    );
  });

export const makeDeletePost = (uc: DeletePostUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    await uc.execute(actorOf(req), p(req, 'id'), p(req, 'postId'));
    sendSuccess(req, res, {}, 'Post deleted.');
  });

export const makeApprovePost = (uc: ApprovePostUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      toPostDto(await uc.execute(actorOf(req), p(req, 'id'), p(req, 'postId'))),
      'Approved.',
    );
  });

export const makeListComments = (uc: ListCommentsUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      (await uc.execute(actorOf(req), p(req, 'id'), p(req, 'postId'))).map(toCommentDto),
      'OK',
    );
  });

export const makeCreateComment = (uc: CreateCommentUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      toCommentDto(await uc.execute(actorOf(req), p(req, 'id'), p(req, 'postId'), req.body)),
      'Comment added.',
      201,
    );
  });

export const makeDeleteComment = (uc: DeleteCommentUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    await uc.execute(actorOf(req), p(req, 'id'), p(req, 'postId'), p(req, 'commentId'));
    sendSuccess(req, res, {}, 'Comment deleted.');
  });
