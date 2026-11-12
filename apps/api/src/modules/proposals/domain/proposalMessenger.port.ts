/** Sends the proposal link to the customer as a WhatsApp message. */
export interface ProposalMessengerPort {
  /** False when sending from here is not set up: the caller falls back to a manual wa.me link. */
  readonly configured: boolean;
  /** `to` is the 10-digit number. Same `idempotencyKey` = one message, however many tries. */
  sendLink(input: {
    to: string;
    firstName: string;
    number: string;
    companyName: string;
    token: string;
    idempotencyKey?: string;
  }): Promise<{ messageId: string | null }>;
}
