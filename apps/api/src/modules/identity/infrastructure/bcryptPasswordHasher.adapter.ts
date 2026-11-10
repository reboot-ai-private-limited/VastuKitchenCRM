import bcrypt from 'bcryptjs';
import type { PasswordHasherPort } from '../domain/passwordHasher.port.js';

export class BcryptPasswordHasher implements PasswordHasherPort {
  private dummyHash: Promise<string> | undefined;

  constructor(private readonly cost: number) {}

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.cost);
  }

  async verify(password: string, hash: string | null): Promise<boolean> {
    if (hash === null) {
      // Same work as a real check, so "no such user" is not measurably faster than "wrong password".
      this.dummyHash ??= bcrypt.hash('not-a-real-password', this.cost);
      await bcrypt.compare(password, await this.dummyHash);
      return false;
    }
    return bcrypt.compare(password, hash);
  }
}
