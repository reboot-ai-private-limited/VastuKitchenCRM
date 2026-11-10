import type { RoleName } from '@vastu/contracts';

declare global {
  namespace Express {
    interface Request {
      /** Set by `authenticate`. Present on every route behind it. */
      user?: { sub: string; role: RoleName };
    }
  }
}

export {};
