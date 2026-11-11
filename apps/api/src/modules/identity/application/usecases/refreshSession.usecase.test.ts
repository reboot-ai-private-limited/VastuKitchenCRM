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

  describe('grace window', () => {
    async function graceSetup(graceMs = 10_000) {
      const users = new FakeUsers();
      const sessions = new FakeSessions();
      const tokens = new FakeTokens();
      let clock = new Date('2026-11-11T10:00:00Z');
      const now = () => clock;
      const issuer = makeIssuer(sessions, tokens, now);
      const user = await addUser(users);
      const first = await issuer.issue(user, 'web');
      const refresh = new RefreshSessionUseCase(sessions, users, tokens, issuer, graceMs, now);
      return {
        users,
        sessions,
        tokens,
        refresh,
        first,
        user,
        advance: (ms: number) => (clock = new Date(clock.getTime() + ms)),
      };
    }

    it('lets a just-spent token be replayed once, with a fresh token and nothing revoked', async () => {
      const { refresh, first, sessions, advance } = await graceSetup();
      const second = await refresh.execute(first.refreshToken, 'web');
      advance(3_000);
      const replay = await refresh.execute(first.refreshToken, 'web');
      expect(replay.refreshToken).not.toBe(first.refreshToken);
      expect(replay.refreshToken).not.toBe(second.refreshToken);
      // Both successors stay usable: whichever one the client kept still works.
      await expect(refresh.execute(second.refreshToken, 'web')).resolves.toBeDefined();
      expect(sessions.rows.filter((s) => !s.revokedAt).length).toBeGreaterThan(0);
    });

    it('treats a second replay as theft and revokes everything', async () => {
      const { refresh, first, sessions, user, advance } = await graceSetup();
      const second = await refresh.execute(first.refreshToken, 'web');
      advance(1_000);
      await refresh.execute(first.refreshToken, 'web');
      advance(1_000);
      await expect(refresh.execute(first.refreshToken, 'web')).rejects.toMatchObject({
        code: 'TOKEN_INVALID',
      });
      await expect(refresh.execute(second.refreshToken, 'web')).rejects.toMatchObject({
        code: 'TOKEN_INVALID',
      });
      expect(sessions.rows.filter((s) => s.userId === user.id).every((s) => s.revokedAt)).toBe(
        true,
      );
    });

    it('treats a replay after the window as theft', async () => {
      const { refresh, first, advance } = await graceSetup();
      await refresh.execute(first.refreshToken, 'web');
      advance(10_001);
      await expect(refresh.execute(first.refreshToken, 'web')).rejects.toMatchObject({
        code: 'TOKEN_INVALID',
      });
    });

    it('does not apply to a token revoked by logout', async () => {
      const { refresh, first, sessions, tokens } = await graceSetup();
      await sessions.revokeByTokenHash(tokens.hash(first.refreshToken));
      await expect(refresh.execute(first.refreshToken, 'web')).rejects.toMatchObject({
        code: 'TOKEN_INVALID',
      });
    });

    it('is off when the window is 0', async () => {
      const { refresh, first } = await graceSetup(0);
      await refresh.execute(first.refreshToken, 'web');
      await expect(refresh.execute(first.refreshToken, 'web')).rejects.toMatchObject({
        code: 'TOKEN_INVALID',
      });
    });

    it('refuses a grace replay once the user is deactivated', async () => {
      const { refresh, first, users, user, advance } = await graceSetup();
      await refresh.execute(first.refreshToken, 'web');
      await users.update(user.id, { active: false });
      advance(1_000);
      await expect(refresh.execute(first.refreshToken, 'web')).rejects.toMatchObject({
        code: 'TOKEN_INVALID',
      });
    });
  });
});
