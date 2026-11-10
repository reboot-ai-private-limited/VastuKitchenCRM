/** Opaque random tokens (refresh tokens, invite tokens). Only the hash is ever stored. */
export interface TokenGeneratorPort {
  generate(): { token: string; hash: string };
  hash(token: string): string;
}
