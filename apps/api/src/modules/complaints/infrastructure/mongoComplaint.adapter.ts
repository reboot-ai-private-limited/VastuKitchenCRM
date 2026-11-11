import { Types, type FilterQuery, type HydratedDocument } from 'mongoose';
import { COMPLAINT_STATUSES, type ComplaintCountsDto } from '@vastu/contracts';
import type {
  Complaint,
  ComplaintFilter,
  NewComplaint,
  Transition,
} from '../domain/complaint.entity.js';
import type { ComplaintRepositoryPort } from '../domain/ports.js';
import { ComplaintModel, type ComplaintDoc } from './complaint.schemas.js';

const oid = (v: string) => new Types.ObjectId(v);
const idOrNull = (v: { toString(): string } | null): string | null => (v ? v.toString() : null);

const toComplaint = (d: HydratedDocument<ComplaintDoc>): Complaint => ({
  id: d.id as string,
  projectId: d.projectId.toString(),
  customerId: d.customerId.toString(),
  description: d.description,
  images: d.images.map((i) => ({ ...i })),
  status: d.status,
  raisedById: idOrNull(d.raisedById),
  assignedToId: idOrNull(d.assignedToId),
  resolutionNote: d.resolutionNote,
  resolutionImages: d.resolutionImages.map((i) => ({ ...i })),
  createdAt: d.createdAt,
  activeSince: d.activeSince,
  assignedAt: d.assignedAt,
  resolvedAt: d.resolvedAt,
  closedAt: d.closedAt,
  reopenCount: d.reopenCount,
  events: d.events.map((e) => ({
    type: e.type,
    at: e.at,
    actorId: idOrNull(e.actorId),
    note: e.note,
    assigneeId: idOrNull(e.assigneeId),
  })),
});

function toQuery(f: ComplaintFilter): FilterQuery<ComplaintDoc> {
  const q: FilterQuery<ComplaintDoc> = {};
  if (f.status) q.status = f.status;
  if (f.projectId) q.projectId = oid(f.projectId);
  if (f.assignedToId) q.assignedToId = oid(f.assignedToId);
  if (f.involving) {
    const me = oid(f.involving);
    q.$or = [{ assignedToId: me }, { raisedById: me }, { customerId: me }];
  }
  return q;
}

export class MongoComplaintRepository implements ComplaintRepositoryPort {
  async create(input: NewComplaint): Promise<Complaint> {
    const doc = await ComplaintModel.create({
      projectId: oid(input.projectId),
      customerId: oid(input.customerId),
      description: input.description,
      images: input.images,
      raisedById: input.raisedById ? oid(input.raisedById) : null,
      status: 'OPEN',
      activeSince: input.at,
      events: [
        {
          type: 'RAISED',
          at: input.at,
          actorId: input.raisedById ? oid(input.raisedById) : null,
          note: null,
          assigneeId: null,
        },
      ],
    });
    return toComplaint(doc);
  }

  async findById(id: string): Promise<Complaint | null> {
    const d = await ComplaintModel.findById(id);
    return d ? toComplaint(d) : null;
  }

  async list(filter: ComplaintFilter, page: { page: number; pageSize: number }) {
    const q = toQuery(filter);
    const [docs, total] = await Promise.all([
      ComplaintModel.find(q)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page.page - 1) * page.pageSize)
        .limit(page.pageSize),
      ComplaintModel.countDocuments(q),
    ]);
    return { items: docs.map(toComplaint), total };
  }

  async counts(filter: ComplaintFilter): Promise<ComplaintCountsDto> {
    const rows = await ComplaintModel.aggregate<{ _id: string; n: number }>([
      { $match: toQuery(filter) },
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]);
    const out = Object.fromEntries(COMPLAINT_STATUSES.map((s) => [s, 0])) as ComplaintCountsDto;
    for (const r of rows) if (r._id in out) out[r._id as keyof ComplaintCountsDto] = r.n;
    return out;
  }

  async transition(id: string, t: Transition): Promise<Complaint | null> {
    const set: Record<string, unknown> = { ...t.set };
    if (t.set.assignedToId !== undefined)
      set['assignedToId'] = t.set.assignedToId ? oid(t.set.assignedToId) : null;
    const event = {
      type: t.event.type,
      at: t.event.at,
      actorId: t.event.actorId ? oid(t.event.actorId) : null,
      note: t.event.note,
      assigneeId: t.event.assigneeId ? oid(t.event.assigneeId) : null,
    };
    // The status guard is part of the filter, so two people acting at once cannot both win.
    const d = await ComplaintModel.findOneAndUpdate(
      { _id: oid(id), status: { $in: t.from } },
      {
        $set: set,
        $push: { events: event },
        ...(t.incReopen ? { $inc: { reopenCount: 1 } } : {}),
      },
      { new: true },
    );
    return d ? toComplaint(d) : null;
  }

  async findStale(before: Date, limit: number): Promise<Complaint[]> {
    const docs = await ComplaintModel.find({
      status: { $in: ['OPEN', 'ASSIGNED'] },
      activeSince: { $lt: before },
    })
      .sort({ activeSince: 1 })
      .limit(limit);
    return docs.map(toComplaint);
  }
}
