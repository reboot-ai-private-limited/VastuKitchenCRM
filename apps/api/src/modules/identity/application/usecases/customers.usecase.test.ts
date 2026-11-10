import { describe, expect, it } from 'vitest';
import {
  CreateCustomerInviteUseCase,
  CreateCustomerUseCase,
  RedeemInviteUseCase,
} from './customers.usecase.js';
import {
  FakeInvites,
  FakeSessions,
  FakeTokens,
  FakeUsers,
  addUser,
  makeIssuer,
} from '../testing/fakes.js';

function setup(now = () => new Date()) {
  const users = new FakeUsers();
  const invites = new FakeInvites();
  const sessions = new FakeSessions();
  const tokens = new FakeTokens();
  return {
    users,
    invites,
    create: new CreateCustomerUseCase(users),
    invite: new CreateCustomerInviteUseCase(
      users,
      invites,
      tokens,
      'https://admin.example.com/',
      7,
      now,
    ),
    redeem: new RedeemInviteUseCase(users, invites, tokens, makeIssuer(sessions, tokens, now), now),
  };
}

describe('customers', () => {
  it('reuses an existing customer and refuses a staff phone number', async () => {
    const { create, users } = setup();
    const a = await create.execute({ name: 'Mrs Rao', phone: '9876500001' });
    const b = await create.execute({ name: 'Mrs Rao', phone: '9876500001' });
    expect(b.id).toBe(a.id);
    await addUser(users, { phone: '9876500002' });
    await expect(create.execute({ name: 'x', phone: '9876500002' })).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('builds a link from the web base URL and signs the customer in once', async () => {
    const { create, invite, redeem } = setup();
    const c = await create.execute({ name: 'Mrs Rao', phone: '9876500001' });
    const link = await invite.execute(c.id);
    expect(link.url).toBe(`https://admin.example.com/invite/${link.token}`);

    const session = await redeem.execute(link.token, 'mobile');
    expect(session.user.id).toBe(c.id);
    await expect(redeem.execute(link.token, 'mobile')).rejects.toMatchObject({
      code: 'TOKEN_INVALID',
    });
  });

  it('a new invite replaces the old one', async () => {
    const { create, invite, redeem } = setup();
    const c = await create.execute({ name: 'Mrs Rao', phone: '9876500001' });
    const first = await invite.execute(c.id);
    await invite.execute(c.id);
    await expect(redeem.execute(first.token, 'web')).rejects.toMatchObject({
      code: 'TOKEN_INVALID',
    });
  });

  it('an expired invite is refused', async () => {
    let t = Date.now();
    const { create, invite, redeem } = setup(() => new Date(t));
    const c = await create.execute({ name: 'Mrs Rao', phone: '9876500001' });
    const link = await invite.execute(c.id);
    t += 8 * 86_400_000;
    await expect(redeem.execute(link.token, 'web')).rejects.toMatchObject({
      code: 'TOKEN_INVALID',
    });
  });

  it('only customers can be invited', async () => {
    const { users, invite } = setup();
    const staff = await addUser(users);
    await expect(invite.execute(staff.id)).rejects.toMatchObject({ statusCode: 404 });
  });
});
