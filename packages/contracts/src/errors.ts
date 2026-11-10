/** The fault-code taxonomy every `AppError` carries. Extend per module as real failure modes appear. */
export const FAULT_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  /** The request body is bigger than the server accepts (413). */
  'PAYLOAD_TOO_LARGE',
  /** An external dependency (Cloudinary, DB…) is unconfigured or down — retry later. */
  'SERVICE_UNAVAILABLE',
  'INTERNAL',
] as const;

export type FaultCode = (typeof FAULT_CODES)[number];
