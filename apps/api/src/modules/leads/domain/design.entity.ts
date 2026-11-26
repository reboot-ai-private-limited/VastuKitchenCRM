import type { DesignMediaKind } from '@vastu/contracts';

export interface LeadDesignMedia {
  kind: DesignMediaKind;
  publicId: string;
  fileName: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  durationSec: number | null;
  resourceType: 'image' | 'video' | 'raw' | null;
  format: string | null;
}

export interface LeadDesign {
  id: string;
  leadId: string;
  userId: string;
  at: Date;
  note: string | null;
  media: LeadDesignMedia[];
}

export type NewLeadDesign = Omit<LeadDesign, 'id'>;

export interface LeadDesignRepositoryPort {
  create(design: NewLeadDesign): Promise<LeadDesign>;
  listByLead(leadId: string): Promise<LeadDesign[]>;
}
