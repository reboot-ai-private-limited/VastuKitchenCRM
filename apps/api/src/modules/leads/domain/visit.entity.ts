import type { VisitMediaKind } from '@vastu/contracts';

export interface VisitMedia {
  kind: VisitMediaKind;
  publicId: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  durationSec: number | null;
}

export interface Visit {
  id: string;
  leadId: string;
  userId: string;
  at: Date;
  latitude: number | null;
  longitude: number | null;
  note: string | null;
  photoUrl: string | null;
  media: VisitMedia[];
}

export type NewVisit = Omit<Visit, 'id'>;
