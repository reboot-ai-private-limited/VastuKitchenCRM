import { AppError } from '@/shared/errors/AppError.js';
import { logger } from '@/shared/logging/logger.js';
import type { OtpSenderPort } from '../domain/otpSender.port.js';

export interface WaAgentConfig {
  apiKey: string;
  phoneNumberId: string;
  template: string;
  language: string;
  baseUrl: string;
}

/**
 * Sends the code as a WhatsApp AUTHENTICATION template through WA AGENT (`POST /v1/messages`).
 * No Idempotency-Key on purpose: a resend is a genuine second message. The code is never logged.
 */
export class WaAgentOtpSender implements OtpSenderPort {
  constructor(private readonly config: WaAgentConfig) {}

  async send(phone: string, code: string): Promise<void> {
    let res: Response;
    try {
      res = await fetch(`${this.config.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          phone_number_id: this.config.phoneNumberId,
          to: `+91${phone}`,
          type: 'template',
          template: {
            name: this.config.template,
            language: { code: this.config.language },
            variables: { code },
          },
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      logger.error({ err }, 'WA AGENT unreachable while sending a login code');
      throw AppError.unavailable('Could not send the code right now. Please try again.');
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
      logger.error(
        { status: res.status, waCode: body?.error?.code },
        'WA AGENT refused a login code',
      );
      throw AppError.unavailable('Could not send the code right now. Please try again.');
    }
  }
}

/** Development stand-in: prints the code in the API console instead of sending anything. */
export class ConsoleOtpSender implements OtpSenderPort {
  async send(phone: string, code: string): Promise<void> {
    logger.warn(`[dev] login code for ${phone}: ${code}`);
  }
}
