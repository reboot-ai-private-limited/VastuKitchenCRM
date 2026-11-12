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

  // An account was deactivated → stop pushing to its phones. Idempotent (deleting nothing is fine).
  events.on('user.deactivated', async (e) => {
    await notifications.contract.removeDevicesFor(e.userId);
  });

  // Someone asked for their account to be deleted → tell every active Admin, once each.
  events.on('account.deletion-requested', async (e) => {
    for (const adminId of await identity.contract.getActiveAdminIds()) {
      await notifications.contract.notify({
        userId: adminId,
        type: 'ACCOUNT_DELETION_REQUESTED',
        title: 'Account deletion requested',
        body: `${e.name} (${e.role}) asked for their account to be deleted. It is deactivated; anonymise it when ready.`,
        dedupeKey: `account-deletion:${e.requestId}`,
      });
    }
  });
}
