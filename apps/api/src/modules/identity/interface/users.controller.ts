import type { RequestHandler } from 'express';
import type { PaginatedDto, UserDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import { asyncHandler } from '@/shared/http/asyncHandler.js';
import { sendSuccess } from '@/shared/http/response.util.js';
import type { CreateUserUseCase } from '../application/usecases/createUser.usecase.js';
import type { GetUserUseCase } from '../application/usecases/getUser.usecase.js';
import type { ListUsersUseCase } from '../application/usecases/listUsers.usecase.js';
import type { SetUserPasswordUseCase } from '../application/usecases/setUserPassword.usecase.js';
import type { UpdateUserUseCase } from '../application/usecases/updateUser.usecase.js';
import { toUserDto } from './user.mapper.js';

function actorOf(req: Parameters<RequestHandler>[0]) {
  if (!req.user) throw AppError.unauthenticated();
  return { id: req.user.sub, role: req.user.role };
}

export function makeListUsersController(useCase: ListUsersUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    const actor = actorOf(req);
    const query = req.query as unknown as Parameters<ListUsersUseCase['execute']>[0];
    const { items, total } = await useCase.execute(query);
    const data: PaginatedDto<UserDto> = {
      items: items.map((u) => toUserDto(u, actor.role)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
    sendSuccess(req, res, data, 'OK');
  });
}

export function makeGetUserController(useCase: GetUserUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    const actor = actorOf(req);
    const user = await useCase.execute(String(req.params['id']));
    sendSuccess(req, res, toUserDto(user, actor.role), 'OK');
  });
}

export function makeCreateUserController(useCase: CreateUserUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    const actor = actorOf(req);
    const user = await useCase.execute(actor.role, req.body);
    sendSuccess(req, res, toUserDto(user, actor.role), 'User created.', 201);
  });
}

export function makeUpdateUserController(useCase: UpdateUserUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    const actor = actorOf(req);
    const user = await useCase.execute(actor, String(req.params['id']), req.body);
    sendSuccess(req, res, toUserDto(user, actor.role), 'User updated.');
  });
}

export function makeSetUserPasswordController(useCase: SetUserPasswordUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    const actor = actorOf(req);
    await useCase.execute(actor.role, String(req.params['id']), req.body.password);
    sendSuccess(req, res, {}, 'Password set.');
  });
}
