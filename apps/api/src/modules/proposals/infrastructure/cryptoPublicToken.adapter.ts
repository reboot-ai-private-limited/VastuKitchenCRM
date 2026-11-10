import { randomBytes } from 'node:crypto';
import type { PublicTokenPort } from '../domain/publicToken.port.js';

/** 192 bits of randomness: not guessable, URL-safe. */
export class CryptoPublicToken implements PublicTokenPort {
  generate(): string {
    return randomBytes(24).toString('base64url');
  }
}
