import { z } from 'zod';

/**
 * Role vocabulary. Lives here (not in the `identity` module) because shared HTTP middleware needs
 * it for role-gating and `shared/` may not import a module.
 */
export const ROLE_NAMES = [
  'ADMIN',
  'HR',
  'SALES',
  'DESIGNER',
  'TECHNICIAN',
  'OFFICE',
  'CUSTOMER',
] as const;
export const roleSchema = z.enum(ROLE_NAMES);
export type RoleName = z.infer<typeof roleSchema>;

/** The stateless access-token payload — everything a request-time authorization check needs. */
export const accessTokenPayloadSchema = z.object({
  /** `User.id`. */
  sub: z.string(),
  role: roleSchema,
  iat: z.number(),
  exp: z.number(),
});
export type AccessTokenPayload = z.infer<typeof accessTokenPayloadSchema>;
