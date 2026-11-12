import { logger } from '@/shared/logging/logger.js';
import type { TemplateRef, WaAgentClient } from '@/shared/whatsapp/waAgentClient.js';
import type { OtpSenderPort } from '../domain/otpSender.port.js';

/**
 * Sends the code as a WhatsApp AUTHENTICATION template (one variable, `code`). No Idempotency-Key on
 * purpose: a resend is a genuine second message. The code is never logged.
 */
export class WaAgentOtpSender implements OtpSenderPort {
  constructor(
    private readonly client: WaAgentClient,
    private readonly template: TemplateRef,
  ) {}

  async send(phone: string, code: string): Promise<void> {
    await this.client.sendTemplate({ to: phone, template: this.template, variables: { code } });
  }
}

/** Development stand-in: prints the code in the API console instead of sending anything. */
export class ConsoleOtpSender implements OtpSenderPort {
  async send(phone: string, code: string): Promise<void> {
    logger.warn(`[dev] login code for ${phone}: ${code}`);
  }
}
