import { describe, expect, it } from 'vitest';
import { LoginUseCase } from './login.usecase.js';
import {
  FakeHasher,
  FakeSessions,
  FakeTokens,
  FakeUsers,
  addUser,
  makeIssuer,
} from '../testing/fakes.js';

function setup() {
  const users = new FakeUsers();
  const sessions = new FakeSessions();
  const tokens = new FakeTokens();
  const login = new LoginUseCase(users, new FakeHasher(), makeIssuer(sessions, tokens));
  return { users, sessions, login };
}
const creds = { phone: '9876543210', password: 'secret-pass' };

describe('LoginUseCase', () => {
  it('signs in with the right phone and password and stores only a hash', async () => {
    const { users, sessions, login } = setup();
    await addUser(users);
    const result = await login.execute(creds, 'mobile');
    expect(result.accessToken).toContain('access:');
    expect(sessions.rows).toHaveLength(1);
    expect(sessions.rows[0]?.tokenHash).not.toBe(result.refreshToken);
  });

  it.each([
    ['wrong password', { ...creds, password: 'nope-nope' }, {}],
    ['unknown phone', { ...creds, phone: '9000000000' }, {}],
    ['no password set (no login)', creds, { passwordHash: null }],
    ['deactivated', creds, { active: false }],
  ])('refuses with one generic error: %s', async (_label, input, over) => {
    const { users, login } = setup();
    await addUser(users, over);
    await expect(login.execute(input, 'web')).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('gives customers the longer session', async () => {
    const { users, sessions, login } = setup();
    await addUser(users, { role: 'CUSTOMER' });
    const staff = await addUser(users, { phone: '9111111111' });
    await login.execute({ phone: '9111111111', password: 'secret-pass' }, 'web');
    const days = (sessions.rows[0]!.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(staff.role).toBe('SALES');
    expect(Math.round(days)).toBe(30);
  });
});
