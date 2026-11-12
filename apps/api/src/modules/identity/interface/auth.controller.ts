import type { RequestHandler } from 'express';
import type { LoginResponseDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import { asyncHandler } from '@/shared/http/asyncHandler.js';
import { requireClientKind } from '@/shared/http/client.util.js';
import { sendSuccess } from '@/shared/http/response.util.js';
import type { ChangePasswordUseCase } from '../application/usecases/changePassword.usecase.js';
import type { RequestAccountDeletionUseCase } from '../application/usecases/requestAccountDeletion.usecase.js';
import type { RequestOtpUseCase, VerifyOtpUseCase } from '../application/usecases/otp.usecase.js';
import type { RedeemInviteUseCase } from '../application/usecases/customers.usecase.js';
import type { GetUserUseCase } from '../application/usecases/getUser.usecase.js';
import type { LoginUseCase } from '../application/usecases/login.usecase.js';
import type { LogoutUseCase } from '../application/usecases/logout.usecase.js';
import type { RefreshSessionUseCase } from '../application/usecases/refreshSession.usecase.js';
import { clearRefreshCookie, deliverTokens, readRefreshToken } from './refreshCookie.js';
import { toUserDto } from './user.mapper.js';

export function makeLoginController(useCase: LoginUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    const client = requireClientKind(req);
    const session = await useCase.execute(req.body, client);
    const body: LoginResponseDto = {
      ...deliverTokens(res, client, session),
      user: toUserDto(session.user, session.user.role),
    };
    sendSuccess(req, res, body, 'Signed in.');
  });
}

export function makeRefreshController(useCase: RefreshSessionUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    const client = requireClientKind(req);
    const token = readRefreshToken(req, client);
    if (!token)
      throw new AppError({
        statusCode: 401,
        code: 'TOKEN_INVALID',
        message: 'Please sign in again.',
      });
    const session = await useCase.execute(token, client);
    sendSuccess(req, res, deliverTokens(res, client, session), 'Session refreshed.');
  });
}

export function makeLogoutController(useCase: LogoutUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    const client = requireClientKind(req);
    const token = readRefreshToken(req, client);
    if (token) await useCase.execute(token);
    if (client === 'web') clearRefreshCookie(res);
    sendSuccess(req, res, {}, 'Signed out.');
  });
}

export function makeMeController(useCase: GetUserUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthenticated();
    const user = await useCase.execute(req.user.sub);
    sendSuccess(req, res, toUserDto(user, user.role), 'OK');
  });
}

export function makeChangePasswordController(useCase: ChangePasswordUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthenticated();
    await useCase.execute(req.user.sub, req.body.currentPassword, req.body.newPassword);
    // Every session was revoked, this browser's included: drop the cookie too.
    if (req.headers['x-client'] === 'web') clearRefreshCookie(res);
    sendSuccess(req, res, {}, 'Password changed. Please sign in again.');
  });
}

export function makeDeleteRequestController(useCase: RequestAccountDeletionUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthenticated();
    await useCase.execute(req.user.sub, (req.body as { reason?: string }).reason);
    // The account is deactivated and every session revoked, this browser's included.
    if (req.headers['x-client'] === 'web') clearRefreshCookie(res);
    sendSuccess(req, res, { requested: true }, 'Your account deletion request has been recorded.');
  });
}

export function makeRedeemInviteController(useCase: RedeemInviteUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    const client = requireClientKind(req);
    const session = await useCase.execute(req.body.token, client);
    const body: LoginResponseDto = {
      ...deliverTokens(res, client, session),
      user: toUserDto(session.user, session.user.role),
    };
    sendSuccess(req, res, body, 'Signed in.');
  });
}

export function makeRequestOtpController(useCase: RequestOtpUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    await useCase.execute(req.body.phone);
    // The same answer for every number, so this cannot be used to look up who has an account.
    sendSuccess(req, res, {}, 'If that number has an account, a code is on its way.');
  });
}

export function makeVerifyOtpController(useCase: VerifyOtpUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    const client = requireClientKind(req);
    const session = await useCase.execute(req.body, client);
    const body: LoginResponseDto = {
      ...deliverTokens(res, client, session),
      user: toUserDto(session.user, session.user.role),
    };
    sendSuccess(req, res, body, 'Signed in.');
  });
}
