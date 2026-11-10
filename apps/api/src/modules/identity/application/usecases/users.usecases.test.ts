import { describe, expect, it } from 'vitest';
import type { CreateUserBodyDto } from '@vastu/contracts';
import { CreateUserUseCase } from './createUser.usecase.js';
import { UpdateUserUseCase } from './updateUser.usecase.js';
import { SetUserPasswordUseCase } from './setUserPassword.usecase.js';
import {
  FakeDesignations,
  FakeHasher,
  FakeSessions,
  FakeUsers,
  addUser,
} from '../testing/fakes.js';

async function setup() {
  const users = new FakeUsers();
  const designations = new FakeDesignations();
  const sessions = new FakeSessions();
  const hasher = new FakeHasher();
  await designations.create('Telecaller');
  await designations.create('Receptionist');
  const retired = await designations.create('Old Title');
  await designations.update(retired.id, { active: false });
  return {
    users,
    designations,
    sessions,
    create: new CreateUserUseCase(users, designations, hasher),
    update: new UpdateUserUseCase(users, designations, sessions),
    setPassword: new SetUserPasswordUseCase(users, hasher, sessions),
  };
}
const body = (over: Partial<CreateUserBodyDto> = {}): CreateUserBodyDto => ({
  name: 'Asha',
  phone: '9876500001',
  role: 'SALES',
  designation: 'telecaller',
  attendanceType: 'BIOMETRIC',
  fixedSalary: 15000,
  ...over,
});

describe('CreateUserUseCase', () => {
  it('copies the master list spelling of the designation onto the user', async () => {
    const { create } = await setup();
    const user = await create.execute('HR', body());
    expect(user.designation).toBe('Telecaller');
  });

  it('creates a user with no password (cannot log in)', async () => {
    const { create } = await setup();
    const user = await create.execute('HR', body({ designation: 'Receptionist', role: 'OFFICE' }));
    expect(user.passwordHash).toBeNull();
  });

  it('rejects unknown and inactive designations', async () => {
    const { create } = await setup();
    await expect(create.execute('ADMIN', body({ designation: 'Wizard' }))).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(create.execute('ADMIN', body({ designation: 'Old Title' }))).rejects.toMatchObject(
      { statusCode: 400 },
    );
  });

  it('lets HR create operational roles but not ADMIN or HR', async () => {
    const { create } = await setup();
    await expect(create.execute('HR', body({ role: 'ADMIN' }))).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(create.execute('HR', body({ role: 'HR' }))).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(create.execute('ADMIN', body({ role: 'HR' }))).resolves.toMatchObject({
      role: 'HR',
    });
  });

  it('rejects a duplicate phone number', async () => {
    const { create } = await setup();
    await create.execute('ADMIN', body());
    await expect(create.execute('ADMIN', body())).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('UpdateUserUseCase', () => {
  it('stops HR from editing an Admin or promoting someone to Admin', async () => {
    const { users, update } = await setup();
    const admin = await addUser(users, { role: 'ADMIN', phone: '9000000001' });
    const sales = await addUser(users, { phone: '9000000002' });
    const hr = { id: 'hr1', role: 'HR' as const };
    await expect(update.execute(hr, admin.id, { name: 'x' })).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(update.execute(hr, sales.id, { role: 'ADMIN' })).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('stops anyone changing their own role or deactivating themselves', async () => {
    const { users, update } = await setup();
    const admin = await addUser(users, { role: 'ADMIN', phone: '9000000001' });
    const actor = { id: admin.id, role: 'ADMIN' as const };
    await expect(update.execute(actor, admin.id, { active: false })).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(update.execute(actor, admin.id, { role: 'HR' })).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('deactivating signs the user out everywhere', async () => {
    const { users, sessions, update } = await setup();
    const sales = await addUser(users, { phone: '9000000002' });
    await sessions.create({
      userId: sales.id,
      tokenHash: 'h',
      client: 'mobile',
      expiresAt: new Date(Date.now() + 1e9),
    });
    await update.execute({ id: 'admin', role: 'ADMIN' }, sales.id, { active: false });
    expect(sessions.rows[0]?.revokedAt).not.toBeNull();
  });

  it('lets a user keep a designation that was deactivated since, but not pick one', async () => {
    const { users, update } = await setup();
    const u = await addUser(users, { phone: '9000000002', designation: 'Old Title' });
    const actor = { id: 'admin', role: 'ADMIN' as const };
    await expect(
      update.execute(actor, u.id, { designation: 'Old Title', name: 'Same' }),
    ).resolves.toBeDefined();
    const other = await addUser(users, { phone: '9000000003', designation: 'Telecaller' });
    await expect(
      update.execute(actor, other.id, { designation: 'Old Title' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('SetUserPasswordUseCase', () => {
  it('gives a no-login employee a login and revokes their old sessions', async () => {
    const { users, setPassword } = await setup();
    const u = await addUser(users, { phone: '9000000002', passwordHash: null });
    await setPassword.execute('HR', u.id, 'brand-new-pass');
    expect(u.passwordHash).toBe('h:brand-new-pass');
  });

  it('blocks HR from resetting an Admin password', async () => {
    const { users, setPassword } = await setup();
    const admin = await addUser(users, { role: 'ADMIN', phone: '9000000001' });
    await expect(setPassword.execute('HR', admin.id, 'brand-new-pass')).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
