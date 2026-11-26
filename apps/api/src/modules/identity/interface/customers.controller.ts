import type { RequestHandler } from 'express';
import type { CustomerInviteDto } from '@vastu/contracts';
import { asyncHandler } from '@/shared/http/asyncHandler.js';
import { sendSuccess } from '@/shared/http/response.util.js';
import type {
  AddCustomerPhoneUseCase,
  CreateCustomerInviteUseCase,
  CreateCustomerUseCase,
  GetCustomerPhonesUseCase,
  RemoveCustomerPhoneUseCase,
} from '../application/usecases/customers.usecase.js';
import { toUserDto } from './user.mapper.js';

export function makeCreateCustomerController(useCase: CreateCustomerUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    const customer = await useCase.execute(req.body);
    sendSuccess(req, res, toUserDto(customer, req.user?.role ?? 'SALES'), 'Customer ready.', 201);
  });
}

export function makeCreateInviteController(useCase: CreateCustomerInviteUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    const invite = await useCase.execute(String(req.params['id']));
    const data: CustomerInviteDto = {
      token: invite.token,
      url: invite.url,
      expiresAt: invite.expiresAt.toISOString(),
    };
    sendSuccess(req, res, data, 'Invite created. Send this link to the customer.', 201);
  });
}

export function makeGetCustomerPhonesController(
  useCase: GetCustomerPhonesUseCase,
): RequestHandler {
  return asyncHandler(async (req, res) => {
    sendSuccess(req, res, await useCase.execute(String(req.params['id'])), 'OK');
  });
}

export function makeAddCustomerPhoneController(useCase: AddCustomerPhoneUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    const body = req.body as { phone: string };
    sendSuccess(
      req,
      res,
      await useCase.execute(String(req.params['id']), body.phone),
      'Login number added.',
      201,
    );
  });
}

export function makeRemoveCustomerPhoneController(
  useCase: RemoveCustomerPhoneUseCase,
): RequestHandler {
  return asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      await useCase.execute(String(req.params['id']), String(req.params['phone'])),
      'Login number removed.',
    );
  });
}
