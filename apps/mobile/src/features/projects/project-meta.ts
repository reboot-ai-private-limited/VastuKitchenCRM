import type { ComplaintStatus, DesignStage, PostVisibility, ProjectStage } from '@vastu/contracts';
import type { Tone } from '@/constants/theme';

export const STAGE_LABEL: Record<ProjectStage, string> = { DESIGN: 'Design', SITE: 'Site work', CLOSED: 'Closed' };
export const STAGE_TONE: Record<ProjectStage, Tone> = { DESIGN: 'violet', SITE: 'warning', CLOSED: 'neutral' };
export const STAGE_ORDER: ProjectStage[] = ['DESIGN', 'SITE', 'CLOSED'];

export const DESIGN_LABEL: Record<DesignStage, string> = {
  NOT_STARTED: 'Design not started',
  IN_DESIGN: 'In design',
  SHARED: 'Design shared',
  APPROVED: 'Design approved',
};
/** Short design sub-status for pairing right next to a `Design` stage badge. */
export const DESIGN_SUB_LABEL: Record<DesignStage, string> = {
  NOT_STARTED: 'Not started',
  IN_DESIGN: 'In progress',
  SHARED: 'Shared',
  APPROVED: 'Approved',
};
export const DESIGN_TONE: Record<DesignStage, Tone> = {
  NOT_STARTED: 'neutral',
  IN_DESIGN: 'info',
  SHARED: 'warning',
  APPROVED: 'success',
};

/** Who can read a chat post. Team only is the default so nothing reaches the customer by accident. */
export const AUDIENCE_LABEL: Record<PostVisibility, string> = { TEAM: 'Team only', CLIENT: 'Client can see' };
export const AUDIENCE_TONE: Record<PostVisibility, Tone> = { TEAM: 'orange', CLIENT: 'success' };

export const COMPLAINT_STATUS_LABEL: Record<ComplaintStatus, string> = {
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};
export const COMPLAINT_STATUS_TONE: Record<ComplaintStatus, Tone> = {
  OPEN: 'danger',
  ASSIGNED: 'warning',
  RESOLVED: 'success',
  CLOSED: 'neutral',
};
