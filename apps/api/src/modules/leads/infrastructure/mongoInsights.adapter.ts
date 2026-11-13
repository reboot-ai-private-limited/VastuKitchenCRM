import { LEAD_STATUSES, type LeadStatus } from '@vastu/contracts';
import type { LeadInsightsPort, UserLeadActivity } from '../domain/insights.port.js';
import { LeadActivityModel } from './leadActivity.schema.js';
import { LeadModel } from './lead.schema.js';

export class MongoLeadInsights implements LeadInsightsPort {
  async countsByStatus() {
    const rows = await LeadModel.aggregate<{ _id: LeadStatus; n: number }>([
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]);
    const out = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as Record<LeadStatus, number>;
    for (const r of rows) if (r._id in out) out[r._id] = r.n;
    return out;
  }

  createdBetween(from: Date, to: Date) {
    return LeadModel.countDocuments({ createdAt: { $gte: from, $lt: to } });
  }

  async activityByUser(from: Date, to: Date): Promise<UserLeadActivity[]> {
    const rows = await LeadActivityModel.aggregate<{
      _id: unknown;
      actions: number;
      leads: unknown[];
      firstAt: Date;
      lastAt: Date;
    }>([
      { $match: { at: { $gte: from, $lt: to }, byUserId: { $ne: null } } },
      {
        $group: {
          _id: '$byUserId',
          actions: { $sum: 1 },
          leads: { $addToSet: '$leadId' },
          firstAt: { $min: '$at' },
          lastAt: { $max: '$at' },
        },
      },
    ]);
    return rows.map((r) => ({
      userId: String(r._id),
      actions: r.actions,
      leadsHandled: r.leads.length,
      firstAt: r.firstAt,
      lastAt: r.lastAt,
    }));
  }

  async openLeadIds(limit: number) {
    const docs = await LeadModel.find({ status: { $nin: ['WON', 'LOST'] } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('_id');
    return docs.map((d) => d.id as string);
  }

  async wonLeadIds(from: Date, to: Date, limit: number) {
    const docs = await LeadModel.find({ status: 'WON', statusChangedAt: { $gte: from, $lt: to } })
      .limit(limit)
      .select('_id');
    return docs.map((d) => d.id as string);
  }

  async wonLeads(from: Date, to: Date, limit: number) {
    const docs = await LeadModel.find({ status: 'WON', statusChangedAt: { $gte: from, $lt: to } })
      .limit(limit)
      .select('_id assignedToId');
    return docs.map((d) => ({
      leadId: d.id as string,
      assignedToId: d.assignedToId ? d.assignedToId.toString() : null,
    }));
  }
}
