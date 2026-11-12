import { Router } from 'express';
import type { RoleName } from '@vastu/contracts';
import { env } from '@/config/env.js';
import { createEventBus, type EventBus } from '@/shared/events/appEvents.js';
import { logger } from '@/shared/logging/logger.js';
import { WaAgentClient } from '@/shared/whatsapp/waAgentClient.js';
import { SessionIssuer } from './application/services/sessionIssuer.js';
import { ChangePasswordUseCase } from './application/usecases/changePassword.usecase.js';
import {
  CreateCustomerInviteUseCase,
  CreateCustomerUseCase,
  RedeemInviteUseCase,
} from './application/usecases/customers.usecase.js';
import {
  BootstrapAdminUseCase,
  SeedDesignationsUseCase,
} from './application/usecases/bootstrap.usecase.js';
import { CreateUserUseCase } from './application/usecases/createUser.usecase.js';
import {
  CreateDesignationUseCase,
  ListDesignationsUseCase,
  UpdateDesignationUseCase,
} from './application/usecases/designations.usecase.js';
import { GetUserUseCase } from './application/usecases/getUser.usecase.js';
import { ListUsersUseCase } from './application/usecases/listUsers.usecase.js';
import {
  RequestOtpUseCase,
  VerifyOtpUseCase,
  DEV_OTP_CODE,
} from './application/usecases/otp.usecase.js';
import { RequestAccountDeletionUseCase } from './application/usecases/requestAccountDeletion.usecase.js';
import { MongoDeletionRequestRepository } from './infrastructure/mongoDeletionRequest.adapter.js';
import { LoginUseCase } from './application/usecases/login.usecase.js';
import { LogoutUseCase } from './application/usecases/logout.usecase.js';
import { RefreshSessionUseCase } from './application/usecases/refreshSession.usecase.js';
import { SetUserPasswordUseCase } from './application/usecases/setUserPassword.usecase.js';
import { UpdateUserUseCase } from './application/usecases/updateUser.usecase.js';
import { BcryptPasswordHasher } from './infrastructure/bcryptPasswordHasher.adapter.js';
import { CryptoTokenGenerator } from './infrastructure/cryptoTokenGenerator.adapter.js';
import { JwtAccessTokenSigner } from './infrastructure/jwtAccessTokenSigner.adapter.js';
import { MongoDesignationRepository } from './infrastructure/mongoDesignation.adapter.js';
import { MongoInviteRepository } from './infrastructure/mongoInvite.adapter.js';
import { MongoOtpRepository } from './infrastructure/mongoOtp.adapter.js';
import { ConsoleOtpSender, WaAgentOtpSender } from './infrastructure/waAgentOtpSender.adapter.js';
import { MongoSessionRepository } from './infrastructure/mongoSession.adapter.js';
import { MongoUserRepository } from './infrastructure/mongoUser.adapter.js';
import {
  makeChangePasswordController,
  makeDeleteRequestController,
  makeLoginController,
  makeLogoutController,
  makeMeController,
  makeRedeemInviteController,
  makeRequestOtpController,
  makeVerifyOtpController,
  makeRefreshController,
} from './interface/auth.controller.js';
import { buildAuthRouter } from './interface/auth.route.js';
import {
  makeCreateCustomerController,
  makeCreateInviteController,
} from './interface/customers.controller.js';
import { buildCustomersRouter } from './interface/customers.route.js';
import {
  makeCreateDesignationController,
  makeListDesignationsController,
  makeUpdateDesignationController,
} from './interface/designations.controller.js';
import { buildDesignationsRouter } from './interface/designations.route.js';
import {
  makeCreateUserController,
  makeGetUserController,
  makeListUsersController,
  makeSetUserPasswordController,
  makeUpdateUserController,
} from './interface/users.controller.js';
import { buildUsersRouter } from './interface/users.route.js';
import type { IdentityPublicContract } from './identity.public.js';

export interface IdentityContainer {
  contract: IdentityPublicContract;
  buildRouter: () => Router;
  /** For the seed script (a second composition root); never used by the HTTP server. */
  bootstrap: {
    seedDesignations: SeedDesignationsUseCase;
    createAdmin: BootstrapAdminUseCase;
  };
}

export interface IdentityDeps {
  events: EventBus;
}

export function buildIdentityContainer(
  { events }: IdentityDeps = { events: createEventBus() },
): IdentityContainer {
  // 1. Adapters
  const users = new MongoUserRepository();
  const designations = new MongoDesignationRepository();
  const sessions = new MongoSessionRepository();
  const invites = new MongoInviteRepository();
  const hasher = new BcryptPasswordHasher(env.BCRYPT_COST);
  const signer = new JwtAccessTokenSigner();
  const tokens = new CryptoTokenGenerator();
  const otps = new MongoOtpRepository();
  const otpTemplate = env.WA_AGENT_OTP_TEMPLATE_ID
    ? { id: env.WA_AGENT_OTP_TEMPLATE_ID }
    : env.WA_AGENT_OTP_TEMPLATE
      ? { name: env.WA_AGENT_OTP_TEMPLATE, language: env.WA_AGENT_OTP_LANGUAGE }
      : null;
  if (!(env.WA_AGENT_API_KEY && env.WA_AGENT_PHONE_NUMBER_ID && otpTemplate)) {
    logger.warn(
      env.OTP_DEV_MODE
        ? 'WA AGENT is not configured: login codes print in this console and are always 123456'
        : 'WA AGENT is not configured: login codes print in this console',
    );
  }
  const otpSender =
    env.WA_AGENT_API_KEY && env.WA_AGENT_PHONE_NUMBER_ID && otpTemplate
      ? new WaAgentOtpSender(
          new WaAgentClient({
            apiKey: env.WA_AGENT_API_KEY,
            phoneNumberId: env.WA_AGENT_PHONE_NUMBER_ID,
            baseUrl: env.WA_AGENT_BASE_URL,
          }),
          otpTemplate,
        )
      : new ConsoleOtpSender();

  // 2. Use cases, depending only on ports
  const issuer = new SessionIssuer(sessions, signer, tokens, {
    staffDays: env.REFRESH_TTL_DAYS,
    customerDays: env.CUSTOMER_REFRESH_TTL_DAYS,
  });
  const login = new LoginUseCase(users, hasher, issuer);
  const requestOtp = new RequestOtpUseCase(
    users,
    otps,
    otpSender,
    tokens,
    env.OTP_DEV_MODE ? DEV_OTP_CODE : null,
  );
  const verifyOtp = new VerifyOtpUseCase(users, otps, tokens, issuer);
  const refresh = new RefreshSessionUseCase(
    sessions,
    users,
    tokens,
    issuer,
    env.REFRESH_GRACE_SECONDS * 1000,
  );
  const logout = new LogoutUseCase(sessions, tokens);
  const getUser = new GetUserUseCase(users);
  const requestDeletion = new RequestAccountDeletionUseCase(
    users,
    sessions,
    new MongoDeletionRequestRepository(),
    events,
  );
  const changePassword = new ChangePasswordUseCase(users, hasher, sessions);
  const createUser = new CreateUserUseCase(users, designations, hasher);
  const updateUser = new UpdateUserUseCase(users, designations, sessions, events);
  const setUserPassword = new SetUserPasswordUseCase(users, hasher, sessions);
  const listUsers = new ListUsersUseCase(users);
  const listDesignations = new ListDesignationsUseCase(designations);
  const createDesignation = new CreateDesignationUseCase(designations);
  const updateDesignation = new UpdateDesignationUseCase(designations, users);
  const createCustomer = new CreateCustomerUseCase(users);
  const createInvite = new CreateCustomerInviteUseCase(
    users,
    invites,
    tokens,
    env.WEB_BASE_URL,
    env.CUSTOMER_INVITE_TTL_DAYS,
  );
  const redeemInvite = new RedeemInviteUseCase(users, invites, tokens, issuer);

  const summarise = (u: {
    id: string;
    name: string;
    phone: string;
    role: RoleName;
    designation: string | null;
    active: boolean;
  }) => ({
    id: u.id,
    name: u.name,
    phone: u.phone,
    role: u.role,
    designation: u.designation,
    active: u.active,
  });

  return {
    contract: {
      getUserSummaries: async (ids) => (await users.findByIds(ids)).map(summarise),
      getStaff: async () =>
        (await users.findStaff()).map((u) => ({
          id: u.id,
          name: u.name,
          role: u.role,
          designation: u.designation,
          attendanceType: u.attendanceType,
          fixedSalary: u.fixedSalary,
          active: u.active,
        })),
      getActiveAdminIds: () => users.findActiveIdsByRole('ADMIN'),
      createCustomer: async (input) => summarise(await createCustomer.execute(input)),
      createCustomerInvite: (customerId) => createInvite.execute(customerId),
    },
    bootstrap: {
      seedDesignations: new SeedDesignationsUseCase(designations),
      createAdmin: new BootstrapAdminUseCase(users, hasher),
    },
    buildRouter: () => {
      const router = Router();
      router.use(
        '/auth',
        buildAuthRouter({
          login: makeLoginController(login),
          refresh: makeRefreshController(refresh),
          logout: makeLogoutController(logout),
          me: makeMeController(getUser),
          changePassword: makeChangePasswordController(changePassword),
          deleteRequest: makeDeleteRequestController(requestDeletion),
          redeemInvite: makeRedeemInviteController(redeemInvite),
          requestOtp: makeRequestOtpController(requestOtp),
          verifyOtp: makeVerifyOtpController(verifyOtp),
        }),
      );
      router.use(
        '/users',
        buildUsersRouter({
          list: makeListUsersController(listUsers),
          get: makeGetUserController(getUser),
          create: makeCreateUserController(createUser),
          update: makeUpdateUserController(updateUser),
          setPassword: makeSetUserPasswordController(setUserPassword),
        }),
      );
      router.use(
        '/designations',
        buildDesignationsRouter({
          list: makeListDesignationsController(listDesignations),
          create: makeCreateDesignationController(createDesignation),
          update: makeUpdateDesignationController(updateDesignation),
        }),
      );
      router.use(
        '/customers',
        buildCustomersRouter({
          create: makeCreateCustomerController(createCustomer),
          invite: makeCreateInviteController(createInvite),
        }),
      );
      return router;
    },
  };
}
