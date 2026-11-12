import type {
  DeletionRequest,
  DeletionRequestRepositoryPort,
  NewDeletionRequest,
} from '../domain/deletionRequest.repository.port.js';
import { DeletionRequestModel } from './deletionRequest.schema.js';

export class MongoDeletionRequestRepository implements DeletionRequestRepositoryPort {
  async create(input: NewDeletionRequest): Promise<DeletionRequest> {
    const doc = await DeletionRequestModel.create(input);
    return {
      id: doc.id as string,
      userId: doc.userId.toString(),
      name: doc.name,
      phone: doc.phone,
      role: doc.role,
      reason: doc.reason,
      requestedAt: doc.requestedAt,
      completedAt: doc.completedAt,
    };
  }
}
