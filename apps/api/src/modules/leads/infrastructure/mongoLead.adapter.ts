import { isValidObjectId, type HydratedDocument } from 'mongoose';
import { CLOSED_LEAD_STATUSES } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import { escapeRegex, isDuplicateKey } from '@/shared/db/mongoErrors.js';
import type { Lead, LeadListFilter, LeadPatch, NewLead } from '../domain/lead.entity.js';
import type { LeadRepositoryPort, StuckQuery } from '../domain/lead.repository.port.js';
import { LeadModel, type LeadDoc } from './lead.schema.js';

const idOrNull = (v: { toString(): string } | null): string | null => (v ? v.toString() : null);

function toEntity(doc: HydratedDocument<LeadDoc>): Lead {
  return {
    id: doc.id as string,
    name: doc.name,
    phone: doc.phone,
    altPhone: doc.altPhone,
    email: doc.email,
    city: doc.city,
    notes: doc.notes,
    source: doc.source,
    status: doc.status,
    statusChangedAt: doc.statusChangedAt,
    assignedToId: idOrNull(doc.assignedToId),
    lostReason: doc.lostReason,
    customerId: idOrNull(doc.customerId),
    newProjectRequested: doc.newProjectRequested ?? false,
    createdById: idOrNull(doc.createdById),
    createdAt: doc.createdAt,
  };
}

const duplicatePhone = () => AppError.conflict('A lead with this phone number already exists.');

export class MongoLeadRepository implements LeadRepositoryPort {
  async findById(id: string): Promise<Lead | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await LeadModel.findById(id);
    return doc ? toEntity(doc) : null;
  }

  async findByPhone(phone: string): Promise<Lead | null> {
    const doc = await LeadModel.findOne({ phone });
    return doc ? toEntity(doc) : null;
  }

  async findByPhones(phones: string[]): Promise<Lead[]> {
    return (await LeadModel.find({ phone: { $in: phones } })).map(toEntity);
  }

  async findByIds(ids: string[]): Promise<Lead[]> {
    const valid = ids.filter((id) => isValidObjectId(id));
    return (await LeadModel.find({ _id: { $in: valid } })).map(toEntity);
  }

  async findByCustomerId(customerId: string): Promise<Lead | null> {
    if (!isValidObjectId(customerId)) return null;
    const doc = await LeadModel.findOne({ customerId });
    return doc ? toEntity(doc) : null;
  }

  async findStuck(q: StuckQuery): Promise<Lead[]> {
    const docs = await LeadModel.find({
      statusChangedAt: { $lt: q.before, $gt: q.after },
      status: { $nin: [...CLOSED_LEAD_STATUSES, ...q.excludeStatuses] },
    })
      .sort({ statusChangedAt: 1 })
      .limit(q.limit);
    return docs.map(toEntity);
  }

  async create(lead: NewLead): Promise<Lead> {
    try {
      return toEntity(await LeadModel.create(lead));
    } catch (err) {
      if (isDuplicateKey(err)) throw duplicatePhone();
      throw err;
    }
  }

  async update(id: string, patch: LeadPatch): Promise<Lead | null> {
    if (!isValidObjectId(id)) return null;
    try {
      const doc = await LeadModel.findByIdAndUpdate(id, { $set: patch }, { new: true });
      return doc ? toEntity(doc) : null;
    } catch (err) {
      if (isDuplicateKey(err)) throw duplicatePhone();
      throw err;
    }
  }

  async list(filter: LeadListFilter): Promise<{ items: Lead[]; total: number }> {
    const query: Record<string, unknown> = {};
    if (filter.status) query['status'] = filter.status;
    if (filter.source) query['source'] = filter.source;
    if (filter.customersOnly) query['customerId'] = { $ne: null };

    if (filter.assignedToId !== undefined) {
      // An id that is not even a valid ObjectId can match nothing.
      if (filter.assignedToId !== null && !isValidObjectId(filter.assignedToId)) {
        return { items: [], total: 0 };
      }
      query['assignedToId'] = filter.assignedToId;
    }

    if (filter.stuckBefore) {
      query['statusChangedAt'] = { $lt: filter.stuckBefore };
      // Stuck never applies to finished leads, whatever status filter was also given.
      if (filter.status) {
        if (CLOSED_LEAD_STATUSES.includes(filter.status)) return { items: [], total: 0 };
      } else {
        query['status'] = { $nin: CLOSED_LEAD_STATUSES };
      }
    }

    if (filter.search) {
      const rx = new RegExp(escapeRegex(filter.search), 'i');
      query['$or'] = [{ name: rx }, { phone: rx }, { city: rx }];
    }

    const [docs, total] = await Promise.all([
      LeadModel.find(query)
        .sort(filter.customersOnly ? { statusChangedAt: -1 } : { createdAt: -1 })
        .skip((filter.page - 1) * filter.pageSize)
        .limit(filter.pageSize),
      LeadModel.countDocuments(query),
    ]);
    return { items: docs.map(toEntity), total };
  }
}
