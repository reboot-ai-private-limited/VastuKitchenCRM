import type { AppContainers } from './container.js';

/**
 * Event wiring, at the composition root: this is the one place that knows both who announces an
 * event and who reacts to it, so no lower module ever imports a higher one.
 *
 * Handlers must be IDEMPOTENT: a handler that throws is only logged (the event bus), never retried.
 */
export function registerSubscribers({
  events,
  notifications,
  projects,
  identity,
}: AppContainers): void {
  // A lead was won → create its project. Idempotent (one per won lead), so a replay is harmless.
  events.on('lead.won', async (e) => {
    await projects.contract.createFromWonLead({
      leadId: e.leadId,
      customerId: e.customerId,
      name: e.name,
      byUserId: e.byUserId,
      ...(e.again ? { again: true } : {}),
    });
  });

  // The customer opened a proposal → tell the person who sent it.
  events.on('proposal.seen', async (e) => {
    if (e.sentById === null) return;
    await notifications.contract.notify({
      userId: e.sentById,
      type: 'PROPOSAL_SEEN',
      title: 'Proposal seen',
      body: `${e.customerName} just opened proposal ${e.number}.`,
      ref: { kind: 'PROPOSAL', id: e.proposalId },
      // A proposal's first view happens once; the key makes even a replayed event harmless.
      dedupeKey: `proposal-seen:${e.proposalId}`,
    });
  });

  // A lead was assigned → tell the new assignee (not when you assign to yourself, or unassign).
  events.on('lead.assigned', async (e) => {
    if (e.toUserId === null || e.toUserId === e.byUserId) return;
    await notifications.contract.notify({
      userId: e.toUserId,
      type: 'LEAD_ASSIGNED',
      title: 'New lead assigned to you',
      body: `${e.leadName} (${e.leadPhone})`,
      ref: { kind: 'LEAD', id: e.leadId },
    });
  });

  // A lead was created → tell its owner, or every Admin when nobody owns it yet. The person who
  // created it already knows.
  events.on('lead.created', async (e) => {
    const recipients =
      e.assignedToId !== null ? [e.assignedToId] : await identity.contract.getActiveAdminIds();
    await Promise.all(
      recipients
        .filter((userId) => userId !== e.byUserId)
        .map((userId) =>
          notifications.contract.notify({
            userId,
            type: 'LEAD_CREATED',
            title: 'New lead',
            body: `${e.leadName} (${e.leadPhone}) via ${e.source}`,
            ref: { kind: 'LEAD', id: e.leadId },
            dedupeKey: `lead-created:${e.leadId}`,
          }),
        ),
    );
  });

  // Measurement done → notify active Designer team members (incl. Designer Team Leader).
  events.on('lead.measurementDone', async (e) => {
    const staff = await identity.contract.getStaff();
    const designers = staff
      .filter((u) => u.active && u.role === 'DESIGNER' && u.id !== e.byUserId)
      .map((u) => u.id);
    await Promise.all(
      designers.map((userId) =>
        notifications.contract.notify({
          userId,
          type: 'LEAD_ASSIGNED',
          title: 'Measurement done — ready for design',
          body: `${e.leadName} is ready for design & estimate.`,
          ref: { kind: 'LEAD', id: e.leadId },
        }),
      ),
    );
  });

  // Design completed → notify the Sales owner (or Admins if unassigned).
  events.on('lead.designCompleted', async (e) => {
    const recipients =
      e.assignedToId !== null ? [e.assignedToId] : await identity.contract.getActiveAdminIds();
    await Promise.all(
      recipients
        .filter((userId) => userId !== e.byUserId)
        .map((userId) =>
          notifications.contract.notify({
            userId,
            type: 'FILE_ADDED',
            title: 'Design completed — ready for estimate',
            body: `${e.designerName} uploaded design for ${e.leadName}${e.mediaCount > 0 ? ` (${e.mediaCount} file${e.mediaCount === 1 ? '' : 's'})` : ''}.`,
            ref: { kind: 'LEAD', id: e.leadId },
          }),
        ),
    );
  });

  // Estimate done → notify the Sales owner (or Admins) that the proposal is ready to send on WhatsApp.
  events.on('lead.estimateDone', async (e) => {
    const recipients =
      e.assignedToId !== null ? [e.assignedToId] : await identity.contract.getActiveAdminIds();
    await Promise.all(
      recipients
        .filter((userId) => userId !== e.byUserId)
        .map((userId) =>
          notifications.contract.notify({
            userId,
            type: 'LEAD_ASSIGNED',
            title: 'Estimate done — ready to send proposal',
            body: `${e.leadName}'s design estimate is done. Ready to send the proposal on WhatsApp.`,
            ref: { kind: 'LEAD', id: e.leadId },
          }),
        ),
    );
  });
}
