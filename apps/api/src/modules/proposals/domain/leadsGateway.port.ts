import type { RoleName } from '@vastu/contracts';

export interface ActorRef {
  id: string;
  role: RoleName;
}

export interface LeadInfo {
  id: string;
  name: string;
  phone: string;
  city: string | null;
}

/** What proposals needs from the leads module (the adapter wraps leads' public contract). */
export interface LeadsGatewayPort {
  /** The lead if `actor` may access it; throws NOT FOUND otherwise. */
  getLead(actor: ActorRef, leadId: string): Promise<LeadInfo>;
  recordSent(actor: ActorRef, leadId: string, number: string): Promise<void>;
  recordSeen(leadId: string, number: string): Promise<void>;
}
