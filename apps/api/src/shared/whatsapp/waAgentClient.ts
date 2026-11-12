import { AppError } from '@/shared/errors/AppError.js';
import { logger } from '@/shared/logging/logger.js';

export interface WaAgentConfig {
  apiKey: string;
  phoneNumberId: string;
  baseUrl: string;
}

/** A template is named by its id (what the WA AGENT portal's "For the API" card shows), or by name + language. */
export type TemplateRef = { id: string } | { name: string; language: string };

export interface SentMessage {
  /** WhatsApp's own id (`wamid…`), for looking up delivery later. */
  wamid: string | null;
  /** WA AGENT's id for the message. */
  messageId: string | null;
}

/**
 * One door to WA AGENT's `POST /v1/messages`, for every template we send (login codes, proposal
 * links). Server-side only: the API key never leaves the server. `to` is a 10-digit Indian mobile
 * number; the `+91` is added here, because WA AGENT refuses a number without its country code.
 */
export class WaAgentClient {
  constructor(private readonly config: WaAgentConfig) {}

  async sendTemplate(input: {
    to: string;
    template: TemplateRef;
    variables: Record<string, string>;
    /** Same key = same message: a retry or a double click sends once. Leave it out for a genuine resend. */
    idempotencyKey?: string;
  }): Promise<SentMessage> {
    let res: Response;
    try {
      res = await fetch(`${this.config.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          ...(input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : {}),
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          phone_number_id: this.config.phoneNumberId,
          to: `+91${input.to}`,
          type: 'template',
          template: { ...input.template, variables: input.variables },
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      logger.error({ err }, 'WA AGENT unreachable');
      throw AppError.unavailable('WhatsApp could not be reached right now. Please try again.');
    }
    const body = (await res.json().catch(() => null)) as {
      messages?: Array<{ id?: string }>;
      message_id?: string;
      error?: { code?: string; message?: string };
    } | null;
    if (!res.ok) {
      // Never log the variables: for a login code they are the secret.
      logger.error({ status: res.status, waCode: body?.error?.code }, 'WA AGENT refused a message');
      throw AppError.unavailable(
        body?.error?.code === 'TEMPLATE_NOT_SENDABLE'
          ? 'The WhatsApp template is not approved yet.'
          : 'WhatsApp could not send the message. Please try again.',
      );
    }
    return { wamid: body?.messages?.[0]?.id ?? null, messageId: body?.message_id ?? null };
  }
}
