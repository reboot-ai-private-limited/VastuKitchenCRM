/** The fault-code taxonomy every `AppError` carries. Extend per module as real failure modes appear. */
export const FAULT_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  /** Login failed — deliberately one code for "no such user", "wrong password", "no login" and "inactive". */
  'INVALID_CREDENTIALS',
  /** A login code that is wrong, expired, used up or never sent — one code for all of those. */
  'INVALID_OTP',
  /** An invite or refresh token that is expired, used or unknown. */
  'TOKEN_INVALID',
  /** Too many attempts in a short time (429). */
  'RATE_LIMITED',
  /** The app build is older than the server still supports (426). */
  'UPGRADE_REQUIRED',
  /** The request body is bigger than the server accepts (413). */
  'PAYLOAD_TOO_LARGE',
  /** An external dependency (Cloudinary, DB…) is unconfigured or down — retry later. */
  'SERVICE_UNAVAILABLE',
  'INTERNAL',
] as const;

export type FaultCode = (typeof FAULT_CODES)[number];
