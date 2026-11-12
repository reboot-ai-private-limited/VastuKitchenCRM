/** Delivers a login code to a person. The code is never logged by an adapter that really sends. */
export interface OtpSenderPort {
  /** `phone` is the 10-digit Indian mobile number. */
  send(phone: string, code: string): Promise<void>;
}
