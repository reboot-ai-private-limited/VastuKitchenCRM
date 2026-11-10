export interface PublicTokenPort {
  /** A new unguessable URL-safe token. */
  generate(): string;
}
