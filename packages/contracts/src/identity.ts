import { z } from 'zod';
import { roleSchema } from './auth.js';

/* ── shared field schemas ─────────────────────────────────────────────────── */

/** Indian mobile number. Accepts `+91 98765 43210`, `098765…`, `9876543210`; stores 10 digits. */
export const phoneSchema = z
  .string()
  .transform((v) => {
    const digits = v.replace(/\D/g, '');
    return digits.length === 12 && digits.startsWith('91')
      ? digits.slice(2)
      : digits.replace(/^0/, '');
  })
  .pipe(z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'));

/** bcrypt only reads the first 72 BYTES, so longer passwords are refused rather than truncated. */
export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .refine((v) => new TextEncoder().encode(v).length <= 72, 'At most 72 bytes');

export const ATTENDANCE_TYPES = ['GPS', 'BIOMETRIC'] as const;
export const attendanceTypeSchema = z.enum(ATTENDANCE_TYPES);
export type AttendanceType = z.infer<typeof attendanceTypeSchema>;

/** Roles an account can have through the staff endpoints (customers are created separately). */
export const STAFF_ROLES = ['ADMIN', 'HR', 'SALES', 'DESIGNER', 'TECHNICIAN', 'OFFICE'] as const;
export const staffRoleSchema = z.enum(STAFF_ROLES);
export type StaffRole = z.infer<typeof staffRoleSchema>;

/** Which client is calling. Decides how the refresh token travels (cookie vs body). */
export const CLIENT_KINDS = ['web', 'mobile'] as const;
export const clientKindSchema = z.enum(CLIENT_KINDS);
export type ClientKind = z.infer<typeof clientKindSchema>;
export const CLIENT_HEADER = 'x-client';

/* ── auth ─────────────────────────────────────────────────────────────────── */

export const loginBodySchema = z.object({ phone: phoneSchema, password: z.string().min(1) });
export type LoginBodyDto = z.infer<typeof loginBodySchema>;

/** Step 1 of OTP sign-in: ask for a code to be sent to this phone. */
export const otpRequestBodySchema = z.object({ phone: phoneSchema });
export type OtpRequestBodyDto = z.infer<typeof otpRequestBodySchema>;

/** Step 2: the 6-digit code that arrived. */
export const otpVerifyBodySchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});
export type OtpVerifyBodyDto = z.infer<typeof otpVerifyBodySchema>;

/** Mobile only. A browser sends the refresh token as a cookie instead. */
export const refreshBodySchema = z.object({ refreshToken: z.string().min(1).optional() });
export type RefreshBodyDto = z.infer<typeof refreshBodySchema>;

export const logoutBodySchema = refreshBodySchema;

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
export type ChangePasswordBodyDto = z.infer<typeof changePasswordBodySchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  /** Present only for `X-Client: mobile`; a browser gets it as an httpOnly cookie. */
  refreshToken: z.string().optional(),
  /** Access-token lifetime in seconds. */
  expiresIn: z.number().int(),
});
export type AuthTokensDto = z.infer<typeof authTokensSchema>;

/* ── users ────────────────────────────────────────────────────────────────── */

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: phoneSchema,
  role: roleSchema,
  designation: z.string().nullable(),
  /** Null for customers. */
  attendanceType: attendanceTypeSchema.nullable(),
  /** Rupees. Present only for ADMIN and HR; omitted for everyone else. */
  fixedSalary: z.number().optional(),
  active: z.boolean(),
  /** False for staff tracked only by biometric: they cannot log in. */
  canLogin: z.boolean(),
  createdAt: z.string(),
});
export type UserDto = z.infer<typeof userSchema>;

export const loginResponseSchema = authTokensSchema.extend({ user: userSchema });
export type LoginResponseDto = z.infer<typeof loginResponseSchema>;

export const createUserBodySchema = z.object({
  name: z.string().trim().min(1),
  phone: phoneSchema,
  role: staffRoleSchema,
  /** Must match an ACTIVE entry in the designations master list. */
  designation: z.string().trim().min(1),
  attendanceType: attendanceTypeSchema,
  fixedSalary: z.number().min(0).default(0),
  /** Omit for a user who needs no app login. */
  password: passwordSchema.optional(),
});
export type CreateUserBodyDto = z.infer<typeof createUserBodySchema>;

export const updateUserBodySchema = z
  .object({
    name: z.string().trim().min(1),
    role: staffRoleSchema,
    designation: z.string().trim().min(1),
    attendanceType: attendanceTypeSchema,
    fixedSalary: z.number().min(0),
    active: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateUserBodyDto = z.infer<typeof updateUserBodySchema>;

export const setUserPasswordBodySchema = z.object({ password: passwordSchema });
export type SetUserPasswordBodyDto = z.infer<typeof setUserPasswordBodySchema>;

export const userIdParamsSchema = z.object({ id: z.string().min(1) });

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  role: roleSchema.optional(),
  active: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type ListUsersQueryDto = z.infer<typeof listUsersQuerySchema>;

/* ── designations (master data) ───────────────────────────────────────────── */

export const designationSchema = z.object({
  id: z.string(),
  name: z.string(),
  active: z.boolean(),
});
export type DesignationDto = z.infer<typeof designationSchema>;

export const createDesignationBodySchema = z.object({ name: z.string().trim().min(1).max(60) });
export type CreateDesignationBodyDto = z.infer<typeof createDesignationBodySchema>;

export const updateDesignationBodySchema = z
  .object({ name: z.string().trim().min(1).max(60), active: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateDesignationBodyDto = z.infer<typeof updateDesignationBodySchema>;

export const listDesignationsQuerySchema = z.object({
  /** `true` also returns deactivated entries (admin screen). */
  includeInactive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

/* ── customers & invites ──────────────────────────────────────────────────── */

export const createCustomerBodySchema = z.object({
  name: z.string().trim().min(1),
  phone: phoneSchema,
});
export type CreateCustomerBodyDto = z.infer<typeof createCustomerBodySchema>;

export const customerInviteSchema = z.object({
  /** The one-time token; shown once, never stored in clear text. */
  token: z.string(),
  /** Ready-to-send link, built from the web app's base URL. */
  url: z.string(),
  expiresAt: z.string(),
});
export type CustomerInviteDto = z.infer<typeof customerInviteSchema>;

export const redeemInviteBodySchema = z.object({ token: z.string().min(1) });
export type RedeemInviteBodyDto = z.infer<typeof redeemInviteBodySchema>;
