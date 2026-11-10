import { createHash, randomBytes } from 'node:crypto';
import type { TokenGeneratorPort } from '../domain/tokenGenerator.port.js';

/** 256 bits of randomness; stored as SHA-256 (a fast hash is right for high-entropy tokens). */
export class CryptoTokenGenerator implements TokenGeneratorPort {
  generate(): { token: string; hash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: this.hash(token) };
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
