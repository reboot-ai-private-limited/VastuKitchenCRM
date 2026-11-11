import { isValidObjectId, type HydratedDocument } from 'mongoose';
import { escapeRegex, isDuplicateKey } from '@/shared/db/mongoErrors.js';
import type { ProjectRepositoryPort } from '../domain/ports.js';
import type {
  NewProject,
  Project,
  ProjectListFilter,
  ProjectPatch,
} from '../domain/project.entity.js';
import { ProjectModel, type ProjectDoc } from './project.schema.js';

const idOrNull = (v: { toString(): string } | null): string | null => (v ? v.toString() : null);

function toEntity(doc: HydratedDocument<ProjectDoc>): Project {
  return {
    id: doc.id as string,
    name: doc.name,
    customerId: doc.customerId.toString(),
    leadId: idOrNull(doc.leadId),
    wonLeadId: idOrNull(doc.wonLeadId),
    siteAddress: doc.siteAddress,
    value: doc.value,
    stage: doc.stage,
    designStage: doc.designStage,
    designerId: idOrNull(doc.designerId),
    memberIds: doc.memberIds.map((m) => m.toString()),
    createdById: idOrNull(doc.createdById),
    closedAt: doc.closedAt,
    createdAt: doc.createdAt,
  };
}

export class MongoProjectRepository implements ProjectRepositoryPort {
  async create(project: NewProject): Promise<Project> {
    return toEntity(await ProjectModel.create(project));
  }

  async createFromWonLead(
    project: NewProject & { wonLeadId: string },
  ): Promise<{ project: Project; created: boolean }> {
    try {
      return { project: toEntity(await ProjectModel.create(project)), created: true };
    } catch (err) {
      // The unique wonLeadId index says this lead already has its project.
      if (!isDuplicateKey(err)) throw err;
      const existing = await ProjectModel.findOne({ wonLeadId: project.wonLeadId });
      if (!existing) throw err;
      return { project: toEntity(existing), created: false };
    }
  }

  async findById(id: string): Promise<Project | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await ProjectModel.findById(id);
    return doc ? toEntity(doc) : null;
  }

  async update(id: string, patch: ProjectPatch): Promise<Project | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await ProjectModel.findByIdAndUpdate(id, { $set: patch }, { new: true });
    return doc ? toEntity(doc) : null;
  }

  async list(filter: ProjectListFilter): Promise<{ items: Project[]; total: number }> {
    const query: Record<string, unknown> = {};
    for (const key of ['designerId', 'customerId', 'leadId'] as const) {
      const value = filter[key];
      if (value === undefined) continue;
      // An id that is not even a valid ObjectId can match nothing.
      if (!isValidObjectId(value)) return { items: [], total: 0 };
      query[key] = value;
    }
    if (filter.stage) query['stage'] = filter.stage;
    if (filter.designStage) query['designStage'] = filter.designStage;
    if (filter.search) query['name'] = new RegExp(escapeRegex(filter.search), 'i');
    if (filter.visibleTo !== undefined) {
      if (!isValidObjectId(filter.visibleTo)) return { items: [], total: 0 };
      query['$or'] = [{ customerId: filter.visibleTo }, { memberIds: filter.visibleTo }];
    }

    const [docs, total] = await Promise.all([
      ProjectModel.find(query)
        .sort({ createdAt: -1 })
        .skip((filter.page - 1) * filter.pageSize)
        .limit(filter.pageSize),
      ProjectModel.countDocuments(query),
    ]);
    return { items: docs.map(toEntity), total };
  }
}
