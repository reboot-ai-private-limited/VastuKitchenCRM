import { randomInt, timingSafeEqual } from 'node:crypto';
import type { ClientKind } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import type { OtpRepositoryPort } from '../../domain/otp.repository.port.js';
import type { OtpSenderPort } from '../../domain/otpSender.port.js';
import type { TokenGeneratorPort } from '../../domain/tokenGenerator.port.js';
import type { UserRepositoryPort } from '../../domain/user.repository.port.js';
import type { IssuedSession, SessionIssuer } from '../services/sessionIssuer.js';

export const OTP_TTL_MS = 5 * 60_000;
export const OTP_RESEND_COOLDOWN_MS = 30_000;
export const OTP_MAX_ATTEMPTS = 5;
export const DEV_OTP_CODE = '123456';

const invalid = () =>
  new AppError({
    statusCode: 401,
    code: 'INVALID_OTP',
    message: 'That code is incorrect or has expired. Ask for a new one.',
  });

/**
 * Sends a login code. Answers the same whether or not the number has an account (and whether or not
 * the resend cooldown applies), so this endpoint cannot be used to find out who has an account.
 */
export class RequestOtpUseCase {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly otps: OtpRepositoryPort,
    private readonly sender: OtpSenderPort,
    private readonly tokens: TokenGeneratorPort,
    private readonly fixedCode: string | null = null,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(phone: string): Promise<void> {
    const user = await this.users.findByPhone(phone);
    if (!user || !user.active) return;

    const now = this.now();
    const last = await this.otps.latestForUser(user.id);
    if (last && now.getTime() - last.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) return;

    const code = this.fixedCode ?? String(randomInt(100_000, 1_000_000));
    await this.otps.replaceForUser({
      userId: user.id,
      codeHash: this.tokens.hash(code),
      expiresAt: new Date(now.getTime() + OTP_TTL_MS),
    });
    await this.sender.send(user.phone, code);
  }
}

/** Checks the code and signs the person in exactly like a password login. One error for every failure. */
export class VerifyOtpUseCase {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly otps: OtpRepositoryPort,
    private readonly tokens: TokenGeneratorPort,
    private readonly issuer: SessionIssuer,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: { phone: string; code: string }, client: ClientKind): Promise<IssuedSession> {
    const user = await this.users.findByPhone(input.phone);
    if (!user || !user.active) throw invalid();

    const now = this.now();
    const challenge = await this.otps.findLive(user.id, now);
    if (!challenge || challenge.attempts >= OTP_MAX_ATTEMPTS) throw invalid();

    const given = Buffer.from(this.tokens.hash(input.code), 'hex');
    const stored = Buffer.from(challenge.codeHash, 'hex');
    const match = given.length === stored.length && timingSafeEqual(given, stored);
    if (!match) {
      await this.otps.recordFailure(challenge.id);
      throw invalid();
    }
    // Atomic: two simultaneous correct submissions cannot both sign in.
    if (!(await this.otps.consume(challenge.id, now))) throw invalid();
    return this.issuer.issue(user, client);
  }
}
