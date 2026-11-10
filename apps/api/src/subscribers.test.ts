import { describe, expect, it } from 'vitest';
import type { NotifyInput } from '@/modules/notifications/notifications.public.js';
import { createEventBus } from '@/shared/events/appEvents.js';
import type { AppContainers } from './container.js';
import { registerSubscribers } from './subscribers.js';

function setup() {
  const events = createEventBus();
  const sent: NotifyInput[] = [];
  const containers = {
    events,
    notifications: {
      contract: {
        notify: async (input: NotifyInput) => {
          sent.push(input);
          return { created: true };
        },
      },
    },
  } as unknown as AppContainers;
  registerSubscribers(containers);
  const settle = () => new Promise((r) => setTimeout(r, 5)); // handlers run on a microtask
  return { events, sent, settle };
}

describe('event subscribers', () => {
  it('tells the sender when a proposal is first opened (keyed, so a replay is harmless)', async () => {
    const { events, sent, settle } = setup();
    events.emit('proposal.seen', {
      proposalId: 'p1',
      leadId: 'l1',
      number: 'VK-2026-0001',
      sentById: 'sales1',
      customerName: 'Mrs Rao',
    });
    await settle();
    expect(sent).toEqual([
      {
        userId: 'sales1',
        type: 'PROPOSAL_SEEN',
        title: 'Proposal seen',
        body: 'Mrs Rao just opened proposal VK-2026-0001.',
        ref: { kind: 'PROPOSAL', id: 'p1' },
        dedupeKey: 'proposal-seen:p1',
      },
    ]);
  });

  it('tells the new assignee, but not on self-assignment or unassignment', async () => {
    const { events, sent, settle } = setup();
    const base = { leadId: 'l1', leadName: 'Mrs Rao', leadPhone: '9876500001' };
    events.emit('lead.assigned', { ...base, toUserId: 'sales1', byUserId: 'admin1' });
    events.emit('lead.assigned', { ...base, toUserId: 'admin1', byUserId: 'admin1' });
    events.emit('lead.assigned', { ...base, toUserId: null, byUserId: 'admin1' });
    await settle();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      userId: 'sales1',
      type: 'LEAD_ASSIGNED',
      body: 'Mrs Rao (9876500001)',
    });
  });
});
