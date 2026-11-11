import type { AlertSenderPort, UserDirectoryPort } from '../../domain/ports.js';
import type { Complaint } from '../../domain/complaint.entity.js';

/**
 * Who hears about a complaint. Whoever just acted is never told about their own action.
 *  raised   → every Admin
 *  assigned → the technician
 *  resolved → Admins, the customer and whoever raised it
 *  reopened → the technician and Admins
 *  closed   → the customer
 */
export class ComplaintAlerts {
  constructor(
    private readonly sender: AlertSenderPort,
    private readonly directory: UserDirectoryPort,
  ) {}

  private ref(c: Complaint) {
    return { kind: 'COMPLAINT' as const, id: c.id, projectId: c.projectId };
  }

  private async deliver(
    userIds: Array<string | null>,
    actorId: string,
    alert: Parameters<AlertSenderPort['send']>[1],
  ): Promise<void> {
    const to = [...new Set(userIds.filter((u): u is string => !!u && u !== actorId))];
    if (to.length > 0) await this.sender.send(to, alert);
  }

  async raised(c: Complaint, projectName: string, actorId: string, actorName: string) {
    await this.deliver(await this.directory.activeAdminIds(), actorId, {
      type: 'COMPLAINT_RAISED',
      title: `New complaint — ${projectName}`,
      body: `${actorName}: ${snippet(c.description)}`,
      ref: this.ref(c),
    });
  }

  async assigned(c: Complaint, projectName: string, actorId: string) {
    await this.deliver([c.assignedToId], actorId, {
      type: 'COMPLAINT_ASSIGNED',
      title: 'A complaint was assigned to you',
      body: `${projectName}: ${snippet(c.description)}`,
      ref: this.ref(c),
    });
  }

  async resolved(c: Complaint, projectName: string, actorId: string, actorName: string) {
    await this.deliver(
      [...(await this.directory.activeAdminIds()), c.customerId, c.raisedById],
      actorId,
      {
        type: 'COMPLAINT_RESOLVED',
        title: `Complaint resolved — ${projectName}`,
        body: `${actorName}: ${snippet(c.resolutionNote ?? c.description)}`,
        ref: this.ref(c),
      },
    );
  }

  async reopened(c: Complaint, projectName: string, actorId: string, reason: string) {
    await this.deliver([c.assignedToId, ...(await this.directory.activeAdminIds())], actorId, {
      type: 'COMPLAINT_REOPENED',
      title: `Complaint reopened — ${projectName}`,
      body: snippet(reason),
      ref: this.ref(c),
    });
  }

  async closed(c: Complaint, projectName: string, actorId: string) {
    await this.deliver([c.customerId], actorId, {
      type: 'COMPLAINT_CLOSED',
      title: 'Your complaint was closed',
      body: `${projectName}: ${snippet(c.description)}`,
      ref: this.ref(c),
    });
  }
}

export function snippet(text: string, max = 80): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}
