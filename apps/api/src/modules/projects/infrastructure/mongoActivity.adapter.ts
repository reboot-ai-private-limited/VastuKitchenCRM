import { isValidObjectId } from 'mongoose';
import type {
  ActivityListQuery,
  NewProjectActivity,
  ProjectActivity,
} from '../domain/activity.entity.js';
import type { ActivityRepositoryPort } from '../domain/ports.js';
import { ProjectActivityModel } from './projectActivity.schema.js';

export class MongoActivityRepository implements ActivityRepositoryPort {
  async add(activity: NewProjectActivity): Promise<void> {
    await ProjectActivityModel.create(activity);
  }

  async list(q: ActivityListQuery): Promise<ProjectActivity[]> {
    if (!isValidObjectId(q.projectId)) return [];
    const filter: Record<string, unknown> = { projectId: q.projectId };
    if (q.before) filter['at'] = { $lt: q.before };
    const docs = await ProjectActivityModel.find(filter).sort({ at: -1, _id: -1 }).limit(q.limit);
    return docs.map((d) => ({
      id: d.id as string,
      projectId: d.projectId.toString(),
      type: d.type,
      actorId: d.actorId ? d.actorId.toString() : null,
      at: d.at,
      data: d.data,
    }));
  }
}
