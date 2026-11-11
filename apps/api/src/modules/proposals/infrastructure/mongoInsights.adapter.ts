import { Types } from 'mongoose';
import { ProposalModel } from './proposal.schema.js';

export interface UserProposalActivity {
  userId: string;
  generated: number;
  sent: number;
  firstAt: Date;
  lastAt: Date;
}

/** Read-only questions the dashboard asks of proposals. */
export class MongoProposalInsights {
  async activityByUser(from: Date, to: Date): Promise<UserProposalActivity[]> {
    const [made, sent] = await Promise.all([
      ProposalModel.aggregate<{ _id: unknown; n: number; first: Date; last: Date }>([
        { $match: { createdAt: { $gte: from, $lt: to } } },
        {
          $group: {
            _id: '$createdById',
            n: { $sum: 1 },
            first: { $min: '$createdAt' },
            last: { $max: '$createdAt' },
          },
        },
      ]),
      ProposalModel.aggregate<{ _id: unknown; n: number; first: Date; last: Date }>([
        { $match: { sentAt: { $gte: from, $lt: to }, sentById: { $ne: null } } },
        {
          $group: {
            _id: '$sentById',
            n: { $sum: 1 },
            first: { $min: '$sentAt' },
            last: { $max: '$sentAt' },
          },
        },
      ]),
    ]);
    const by = new Map<string, UserProposalActivity>();
    const row = (id: string, first: Date, last: Date) => {
      const r = by.get(id) ?? { userId: id, generated: 0, sent: 0, firstAt: first, lastAt: last };
      if (first < r.firstAt) r.firstAt = first;
      if (last > r.lastAt) r.lastAt = last;
      by.set(id, r);
      return r;
    };
    for (const m of made) row(String(m._id), m.first, m.last).generated = m.n;
    for (const s of sent) row(String(s._id), s.first, s.last).sent = s.n;
    return [...by.values()];
  }

  /** The total of each lead's most recently SENT proposal (leads with none are absent). */
  async latestSentTotals(leadIds: string[]): Promise<Array<{ leadId: string; total: number }>> {
    const ids = leadIds.filter((i) => Types.ObjectId.isValid(i)).map((i) => new Types.ObjectId(i));
    if (ids.length === 0) return [];
    const rows = await ProposalModel.aggregate<{ _id: unknown; total: number }>([
      { $match: { leadId: { $in: ids }, status: 'SENT' } },
      { $sort: { sentAt: -1 } },
      { $group: { _id: '$leadId', total: { $first: '$total' } } },
    ]);
    return rows.map((r) => ({ leadId: String(r._id), total: r.total }));
  }
}
