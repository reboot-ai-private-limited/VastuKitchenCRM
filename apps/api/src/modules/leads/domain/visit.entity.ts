export interface Visit {
  id: string;
  leadId: string;
  userId: string;
  at: Date;
  latitude: number;
  longitude: number;
  note: string | null;
  photoUrl: string | null;
}

export type NewVisit = Omit<Visit, 'id'>;
