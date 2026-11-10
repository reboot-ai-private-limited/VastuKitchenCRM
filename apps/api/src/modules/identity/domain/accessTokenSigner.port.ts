import type { RoleName } from '@vastu/contracts';

export interface AccessTokenSignerPort {
  sign(userId: string, role: RoleName): { token: string; expiresIn: number };
}
