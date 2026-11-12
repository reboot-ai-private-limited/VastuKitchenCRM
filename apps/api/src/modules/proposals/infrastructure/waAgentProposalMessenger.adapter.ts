import type { TemplateRef, WaAgentClient } from '@/shared/whatsapp/waAgentClient.js';
import type { ProposalMessengerPort } from '../domain/proposalMessenger.port.js';

/**
 * The approved `proposal_share` template: body.1 first name, body.2 proposal number, body.3 company
 * name, and the URL button's variable (`button.0.1`) is the proposal token, which the template
 * appends to `<domain>/p/`. The token is percent-encoded because WhatsApp appends it, not substitutes it.
 */
export class WaAgentProposalMessenger implements ProposalMessengerPort {
  readonly configured = true;
  constructor(
    private readonly client: WaAgentClient,
    private readonly template: TemplateRef,
  ) {}

  async sendLink(input: {
    to: string;
    firstName: string;
    number: string;
    companyName: string;
    token: string;
    idempotencyKey?: string;
  }): Promise<{ messageId: string | null }> {
    const sent = await this.client.sendTemplate({
      to: input.to,
      template: this.template,
      variables: {
        'body.1': input.firstName,
        'body.2': input.number,
        'body.3': input.companyName,
        'button.0.1': encodeURIComponent(input.token),
      },
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    });
    return { messageId: sent.messageId ?? sent.wamid };
  }
}

/** Used when WA AGENT is not configured: says so, and the UI offers the manual link instead. */
export class UnconfiguredProposalMessenger implements ProposalMessengerPort {
  readonly configured = false;
  async sendLink(): Promise<{ messageId: string | null }> {
    return { messageId: null };
  }
}
