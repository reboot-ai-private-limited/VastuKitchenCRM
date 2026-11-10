import type { ClientKind, CreateCustomerBodyDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import type { InviteRepositoryPort } from '../../domain/invite.repository.port.js';
import type { TokenGeneratorPort } from '../../domain/tokenGenerator.port.js';
import type { User } from '../../domain/user.entity.js';
import type { UserRepositoryPort } from '../../domain/user.repository.port.js';
import type { IssuedSession, SessionIssuer } from '../services/sessionIssuer.js';

const invalidInvite = () =>
  new AppError({
    statusCode: 401,
    code: 'TOKEN_INVALID',
    message: 'This link has expired or was already used. Ask for a new one.',
  });

/** A customer account: no password, no designation, no attendance — they only open invite links. */
export class CreateCustomerUseCase {
  constructor(private readonly users: UserRepositoryPort) {}

  async execute(input: CreateCustomerBodyDto): Promise<User> {
    const existing = await this.users.findByPhone(input.phone);
    if (existing) {
      // The same person is often both a lead and a past customer: reuse the account.
      if (existing.role === 'CUSTOMER') return existing;
      throw AppError.conflict('This phone number belongs to a staff account.');
    }
    return this.users.create({
      name: input.name,
      phone: input.phone,
      role: 'CUSTOMER',
      designation: null,
      attendanceType: null,
      fixedSalary: 0,
      passwordHash: null,
      active: true,
    });
  }
}

export interface CreatedInvite {
  token: string;
  url: string;
  expiresAt: Date;
}

export class CreateCustomerInviteUseCase {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly invites: InviteRepositoryPort,
    private readonly tokens: TokenGeneratorPort,
    private readonly webBaseUrl: string,
    private readonly ttlDays: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(customerId: string): Promise<CreatedInvite> {
    const customer = await this.users.findById(customerId);
    if (!customer || customer.role !== 'CUSTOMER') throw AppError.notFound('Customer not found.');
    if (!customer.active) throw AppError.badRequest('This customer is deactivated.');

    // A new link replaces any earlier one.
    await this.invites.revokeAllForUser(customerId);

    const { token, hash } = this.tokens.generate();
    const expiresAt = new Date(this.now().getTime() + this.ttlDays * 86_400_000);
    await this.invites.create({ userId: customerId, tokenHash: hash, expiresAt });

    const base = this.webBaseUrl.replace(/\/+$/, '');
    return { token, url: `${base}/invite/${token}`, expiresAt };
  }
}

/** Opening the link signs the customer in; the link works once. */
export class RedeemInviteUseCase {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly invites: InviteRepositoryPort,
    private readonly tokens: TokenGeneratorPort,
    private readonly issuer: SessionIssuer,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(token: string, client: ClientKind): Promise<IssuedSession> {
    const invite = await this.invites.consume(this.tokens.hash(token), this.now());
    if (!invite) throw invalidInvite();

    const user = await this.users.findById(invite.userId);
    if (!user || !user.active || user.role !== 'CUSTOMER') throw invalidInvite();
    return this.issuer.issue(user, client);
  }
}
