import { describe, expect, it } from 'vitest';
import { UpdateDesignationUseCase } from './designations.usecase.js';
import { FakeDesignations, FakeUsers, addUser } from '../testing/fakes.js';

describe('UpdateDesignationUseCase', () => {
  it('renames the master entry AND the copied text on every user holding it', async () => {
    const designations = new FakeDesignations();
    const users = new FakeUsers();
    const d = await designations.create('Front Desk');
    await addUser(users, { designation: 'Front Desk', phone: '9000000001' });
    await addUser(users, { designation: 'Front Desk', phone: '9000000002' });
    await addUser(users, { designation: 'Telecaller', phone: '9000000003' });

    await new UpdateDesignationUseCase(designations, users).execute(d.id, {
      name: 'Front Desk Executive',
    });

    expect(users.rows.map((u) => u.designation)).toEqual([
      'Front Desk Executive',
      'Front Desk Executive',
      'Telecaller',
    ]);
  });

  it('refuses a rename that collides with another entry', async () => {
    const designations = new FakeDesignations();
    const a = await designations.create('A');
    await designations.create('B');
    await expect(
      new UpdateDesignationUseCase(designations, new FakeUsers()).execute(a.id, { name: 'b' }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('deactivating leaves existing users untouched', async () => {
    const designations = new FakeDesignations();
    const users = new FakeUsers();
    const d = await designations.create('Old');
    await addUser(users, { designation: 'Old' });
    await new UpdateDesignationUseCase(designations, users).execute(d.id, { active: false });
    expect(users.rows[0]?.designation).toBe('Old');
  });
});
