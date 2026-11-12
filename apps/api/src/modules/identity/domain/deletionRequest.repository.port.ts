export interface DeletionRequest {
  id: string;
  userId: string;
  /** Copied at request time: the account is anonymised later, the record must still say who asked. */
  name: string;
  phone: string;
  role: string;
  reason: string | null;
  requestedAt: Date;
  /** Set when an Admin has carried out the erasure. */
  completedAt: Date | null;
}

export type NewDeletionRequest = Omit<DeletionRequest, 'id' | 'completedAt'>;

export interface DeletionRequestRepositoryPort {
  create(input: NewDeletionRequest): Promise<DeletionRequest>;
}
