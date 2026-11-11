import { createHash, randomBytes } from 'node:crypto';
import type { RoleName } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import type { CustomerInvite, NewCustomerInvite } from '../../domain/invite.entity.js';
import type { InviteRepositoryPort } from '../../domain/invite.repository.port.js';
import type { Designation } from '../../domain/designation.entity.js';
import type { DesignationRepositoryPort } from '../../domain/designation.repository.port.js';
import type { PasswordHasherPort } from '../../domain/passwordHasher.port.js';
import type { NewSession, Session } from '../../domain/session.entity.js';
import type { SessionRepositoryPort } from '../../domain/session.repository.port.js';
import type { TokenGeneratorPort } from '../../domain/tokenGenerator.port.js';
import type { NewUser, User, UserListFilter } from '../../domain/user.entity.js';
import type { UserRepositoryPort } from '../../domain/user.repository.port.js';
import type { AccessTokenSignerPort } from '../../domain/accessTokenSigner.port.js';
import { SessionIssuer } from '../services/sessionIssuer.js';

/** In-memory ports for use-case tests. They honour the same contracts as the Mongo adapters. */

export class FakeUsers implements UserRepositoryPort {
  rows: User[] = [];
  private seq = 0;
  async findById(id: string) {
    return this.rows.find((u) => u.id === id) ?? null;
  }
  async findByPhone(phone: string) {
    return this.rows.find((u) => u.phone === phone) ?? null;
  }
  async findByIds(ids: string[]) {
    return this.rows.filter((u) => ids.includes(u.id));
  }
  async create(user: NewUser) {
    if (this.rows.some((u) => u.phone === user.phone)) throw AppError.conflict('dup');
    const created: User = { ...user, id: `u${++this.seq}`, createdAt: new Date() };
    this.rows.push(created);
    return created;
  }
  async update(id: string, patch: Partial<User>) {
    const user = this.rows.find((u) => u.id === id);
    if (!user) return null;
    Object.assign(user, patch);
    return user;
  }
  async list(_f: UserListFilter) {
    return { items: this.rows, total: this.rows.length };
  }
  async renameDesignation(from: string, to: string) {
    let n = 0;
    for (const u of this.rows) {
      if (u.designation !== from) continue;
      u.designation = to;
      n++;
    }
    return n;
  }
  async findActiveIdsByRole(role: RoleName) {
    return this.rows.filter((u) => u.role === role && u.active).map((u) => u.id);
  }
  async findStaff() {
    return this.rows.filter((u) => u.role !== 'CUSTOMER');
  }
  async hasActiveAdmin() {
    return this.rows.some((u) => u.role === 'ADMIN' && u.active);
  }
}

export class FakeDesignations implements DesignationRepositoryPort {
  rows: Designation[] = [];
  private seq = 0;
  async list(includeInactive: boolean) {
    return this.rows.filter((d) => includeInactive || d.active);
  }
  async findById(id: string) {
    return this.rows.find((d) => d.id === id) ?? null;
  }
  async findByName(name: string) {
    return this.rows.find((d) => d.name.toLowerCase() === name.trim().toLowerCase()) ?? null;
  }
  async create(name: string) {
    if (await this.findByName(name)) throw AppError.conflict('dup');
    const d = { id: `d${++this.seq}`, name: name.trim(), active: true };
    this.rows.push(d);
    return d;
  }
  async update(id: string, patch: { name?: string; active?: boolean }) {
    const d = this.rows.find((x) => x.id === id);
    if (!d) return null;
    Object.assign(d, patch);
    return d;
  }
}

export class FakeSessions implements SessionRepositoryPort {
  rows: Session[] = [];
  private seq = 0;
  async create(s: NewSession) {
    const created: Session = {
      ...s,
      id: `s${++this.seq}`,
      revokedAt: null,
      rotatedAt: null,
      graceUsedAt: null,
    };
    this.rows.push(created);
    return created;
  }
  async findByTokenHash(h: string) {
    return this.rows.find((s) => s.tokenHash === h) ?? null;
  }
  async consume(h: string, now: Date) {
    const s = this.rows.find((x) => x.tokenHash === h && !x.revokedAt && x.expiresAt > now);
    if (!s) return null;
    s.revokedAt = now;
    s.rotatedAt = now;
    return s;
  }
  async claimGrace(h: string, now: Date, windowMs: number) {
    const s = this.rows.find(
      (x) =>
        x.tokenHash === h &&
        x.rotatedAt &&
        x.rotatedAt.getTime() >= now.getTime() - windowMs &&
        !x.graceUsedAt &&
        x.expiresAt > now,
    );
    if (!s) return null;
    s.graceUsedAt = now;
    return s;
  }
  async revokeByTokenHash(h: string) {
    const s = this.rows.find((x) => x.tokenHash === h);
    if (s && !s.revokedAt) s.revokedAt = new Date();
  }
  async revokeAllForUser(userId: string) {
    for (const s of this.rows) if (s.userId === userId && !s.revokedAt) s.revokedAt = new Date();
  }
}

export class FakeInvites implements InviteRepositoryPort {
  rows: CustomerInvite[] = [];
  async create(i: NewCustomerInvite) {
    const created: CustomerInvite = { ...i, id: `i${this.rows.length + 1}`, usedAt: null };
    this.rows.push(created);
    return created;
  }
  async consume(h: string, now: Date) {
    const i = this.rows.find((x) => x.tokenHash === h && !x.usedAt && x.expiresAt > now);
    if (!i) return null;
    i.usedAt = now;
    return i;
  }
  async revokeAllForUser(userId: string) {
    for (const i of this.rows) if (i.userId === userId && !i.usedAt) i.usedAt = new Date();
  }
}

/** Not bcrypt: a reversible stand-in so tests stay fast. */
export class FakeHasher implements PasswordHasherPort {
  async hash(p: string) {
    return `h:${p}`;
  }
  async verify(p: string, hash: string | null) {
    return hash !== null && hash === `h:${p}`;
  }
}

export class FakeTokens implements TokenGeneratorPort {
  generate() {
    const token = randomBytes(8).toString('hex');
    return { token, hash: this.hash(token) };
  }
  hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}

export const fakeSigner: AccessTokenSignerPort = {
  sign: (userId, role) => ({ token: `access:${userId}:${role}`, expiresIn: 900 }),
};

export function makeIssuer(
  sessions: SessionRepositoryPort,
  tokens: TokenGeneratorPort,
  now?: () => Date,
) {
  return new SessionIssuer(sessions, fakeSigner, tokens, { staffDays: 30, customerDays: 90 }, now);
}

export async function addUser(users: FakeUsers, over: Partial<NewUser> = {}) {
  return users.create({
    name: 'Test',
    phone: '9876543210',
    role: 'SALES',
    designation: 'Telecaller',
    attendanceType: 'BIOMETRIC',
    fixedSalary: 1000,
    passwordHash: 'h:secret-pass',
    active: true,
    ...over,
  });
}
