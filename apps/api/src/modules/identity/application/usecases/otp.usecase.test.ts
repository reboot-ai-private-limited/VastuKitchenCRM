import { describe, expect, it } from 'vitest';
import {
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  RequestOtpUseCase,
  VerifyOtpUseCase,
} from './otp.usecase.js';
import {
  FakeOtpSender,
  FakeOtps,
  FakeSessions,
  FakeTokens,
  FakeUsers,
  addUser,
  makeIssuer,
} from '../testing/fakes.js';

function setup() {
  let t = new Date('2026-11-12T10:00:00Z');
  const now = () => t;
  const users = new FakeUsers();
  const otps = new FakeOtps(now);
  const sender = new FakeOtpSender();
  const tokens = new FakeTokens();
  const sessions = new FakeSessions();
  const request = new RequestOtpUseCase(users, otps, sender, tokens, null, now);
  const verify = new VerifyOtpUseCase(users, otps, tokens, makeIssuer(sessions, tokens, now), now);
  return {
    users,
    otps,
    sender,
    sessions,
    request,
    verify,
    advance: (ms: number) => {
      t = new Date(t.getTime() + ms);
    },
  };
}
const phone = '9876543210';

describe('OTP sign-in', () => {
  it('sends a 6-digit code and signs in with it, even for a user with no password', async () => {
    const { users, sender, request, verify, sessions } = setup();
    await addUser(users, { passwordHash: null, role: 'CUSTOMER' });
    await request.execute(phone);
    expect(sender.sent).toHaveLength(1);
    const code = sender.sent[0]!.code;
    expect(code).toMatch(/^\d{6}$/);

    const session = await verify.execute({ phone, code }, 'web');
    expect(session.accessToken).toContain('access:');
    expect(sessions.rows).toHaveLength(1);
  });

  it('stores only a hash of the code', async () => {
    const { users, otps, sender, request } = setup();
    await addUser(users);
    await request.execute(phone);
    expect(otps.rows[0]?.codeHash).not.toContain(sender.sent[0]!.code);
  });

  it('answers silently, and sends nothing, for an unknown or deactivated number', async () => {
    const { users, sender, request } = setup();
    await addUser(users, { active: false });
    await expect(request.execute(phone)).resolves.toBeUndefined();
    await expect(request.execute('9000000000')).resolves.toBeUndefined();
    expect(sender.sent).toHaveLength(0);
  });

  it('ignores a second request inside the resend cooldown, then allows one and voids the first code', async () => {
    const { users, sender, request, verify, advance } = setup();
    await addUser(users);
    await request.execute(phone);
    await request.execute(phone);
    expect(sender.sent).toHaveLength(1);

    advance(OTP_RESEND_COOLDOWN_MS + 1);
    await request.execute(phone);
    expect(sender.sent).toHaveLength(2);
    await expect(
      verify.execute({ phone, code: sender.sent[0]!.code }, 'web'),
    ).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_OTP' });
    await expect(
      verify.execute({ phone, code: sender.sent[1]!.code }, 'web'),
    ).resolves.toBeDefined();
  });

  it('refuses a wrong code, an expired code and a reused code with the same error', async () => {
    const { users, sender, request, verify, advance } = setup();
    await addUser(users);
    await request.execute(phone);
    const code = sender.sent[0]!.code;
    const wrong = code === '000000' ? '000001' : '000000';
    await expect(verify.execute({ phone, code: wrong }, 'web')).rejects.toMatchObject({
      code: 'INVALID_OTP',
    });

    await verify.execute({ phone, code }, 'web');
    await expect(verify.execute({ phone, code }, 'web')).rejects.toMatchObject({
      code: 'INVALID_OTP',
    });

    advance(OTP_RESEND_COOLDOWN_MS + 1);
    await request.execute(phone);
    advance(OTP_TTL_MS + 1);
    await expect(
      verify.execute({ phone, code: sender.sent[1]!.code }, 'web'),
    ).rejects.toMatchObject({ code: 'INVALID_OTP' });
  });

  it('burns the code after too many wrong guesses, even if the right one comes next', async () => {
    const { users, sender, request, verify } = setup();
    await addUser(users);
    await request.execute(phone);
    const code = sender.sent[0]!.code;
    const wrong = code === '000000' ? '000001' : '000000';
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
      await expect(verify.execute({ phone, code: wrong }, 'web')).rejects.toBeDefined();
    }
    await expect(verify.execute({ phone, code }, 'web')).rejects.toMatchObject({
      code: 'INVALID_OTP',
    });
  });

  it('uses a fixed code in demo mode', async () => {
    const t = new FakeTokens();
    const users = new FakeUsers();
    const sender = new FakeOtpSender();
    await addUser(users);
    await new RequestOtpUseCase(users, new FakeOtps(), sender, t, '123456').execute(phone);
    expect(sender.sent[0]?.code).toBe('123456');
  });
});
