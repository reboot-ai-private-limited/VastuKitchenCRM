export interface PasswordHasherPort {
  hash(password: string): Promise<string>;
  /**
   * `hash` may be null (the user has no password). Implementations must still spend comparable
   * time, so response timing doesn't reveal which phone numbers exist.
   */
  verify(password: string, hash: string | null): Promise<boolean>;
}
