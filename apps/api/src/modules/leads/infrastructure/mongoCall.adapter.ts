import type { HydratedDocument } from 'mongoose';
import type { CallRecord, CallStat, NewCallRecord } from '../domain/call.entity.js';
import type { CallRepositoryPort } from '../domain/call.repository.port.js';
import { LeadCallModel, type LeadCallDoc } from './leadCall.schema.js';

const toEntity = (doc: HydratedDocument<LeadCallDoc>): CallRecord => ({
  id: doc.id as string,
  leadId: doc.leadId.toString(),
  userId: doc.userId.toString(),
  startedAt: doc.startedAt,
  durationSec: doc.durationSec,
  answered: doc.answered,
  outcome: doc.outcome,
  note: doc.note,
});

export class MongoCallRepository implements CallRepositoryPort {
  async record(call: NewCallRecord): Promise<{ call: CallRecord; created: boolean }> {
    const key = { leadId: call.leadId, userId: call.userId, startedAt: call.startedAt };
    // Upsert on the unique key: the first upload inserts, a retry matches and changes nothing.
    const res = await LeadCallModel.updateOne(key, { $setOnInsert: call }, { upsert: true });
    const doc = await LeadCallModel.findOne(key);
    return { call: toEntity(doc!), created: res.upsertedCount === 1 };
  }

  async listByLead(leadId: string): Promise<CallRecord[]> {
    return (await LeadCallModel.find({ leadId }).sort({ startedAt: -1 })).map(toEntity);
  }

  async statsByUser(from: Date, to: Date): Promise<CallStat[]> {
    const rows = await LeadCallModel.aggregate<{
      _id: unknown;
      calls: number;
      answered: number;
      talkSeconds: number;
    }>([
      { $match: { startedAt: { $gte: from, $lt: to } } },
      {
        $group: {
          _id: '$userId',
          calls: { $sum: 1 },
          answered: { $sum: { $cond: ['$answered', 1, 0] } },
          talkSeconds: { $sum: '$durationSec' },
        },
      },
    ]);
    return rows.map((r) => ({
      userId: String(r._id),
      calls: r.calls,
      answered: r.answered,
      talkSeconds: r.talkSeconds,
    }));
  }
}
