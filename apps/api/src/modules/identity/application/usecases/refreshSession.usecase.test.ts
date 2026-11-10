import { describe, expect, it } from 'vitest';
import { RefreshSessionUseCase } from './refreshSession.usecase.js';
import { FakeSessions, FakeTokens, FakeUsers, addUser, makeIssuer } from '../testing/fakes.js';

async function setup() {
  const users = new FakeUsers();
  const sessions = new FakeSessions();
  const tokens = new FakeTokens();
  const issuer = makeIssuer(sessions, tokens);
  const user = await addUser(users);
  const first = await issuer.issue(user, 'mobile');
  const refresh = new RefreshSessionUseCase(sessions, users, tokens, issuer);
  return { users, sessions, refresh, first, user };
}

describe('RefreshSessionUseCase', () => {
  it('rotates: the new token works, the old one is spent', async () => {
    const { refresh, first } = await setup();
    const second = await refresh.execute(first.refreshToken, 'mobile');
    expect(second.refreshToken).not.toBe(first.refreshToken);
    await expect(refresh.execute(second.refreshToken, 'mobile')).resolves.toBeDefined();
  });

  it('treats reuse of a spent token as theft and revokes every session of that user', async () => {
    const { refresh, first, sessions, user } = await setup();
    const second = await refresh.execute(first.refreshToken, 'mobile');
    await expect(refresh.execute(first.refreshToken, 'mobile')).rejects.toMatchObject({
      code: 'TOKEN_INVALID',
    });
    // The legitimate holder of the new token is signed out too.
    await expect(refresh.execute(second.refreshToken, 'mobile')).rejects.toMatchObject({
      code: 'TOKEN_INVALID',
    });
    expect(sessions.rows.filter((s) => s.userId === user.id).every((s) => s.revokedAt)).toBe(true);
  });

  it('refuses an unknown token', async () => {
    const { refresh } = await setup();
    await expect(refresh.execute('garbage', 'web')).rejects.toMatchObject({
      code: 'TOKEN_INVALID',
    });
  });

  it('refuses once the user is deactivated', async () => {
    const { refresh, first, users, user } = await setup();
    await users.update(user.id, { active: false });
    await expect(refresh.execute(first.refreshToken, 'mobile')).rejects.toMatchObject({
      code: 'TOKEN_INVALID',
    });
  });
});
