import type { DesignStage, ProjectStage } from '@vastu/contracts';
import type { Tone } from '@/constants/theme';

export const STAGE_LABEL: Record<ProjectStage, string> = { DESIGN: 'Design', SITE: 'Site work', CLOSED: 'Closed' };
export const STAGE_TONE: Record<ProjectStage, Tone> = { DESIGN: 'violet', SITE: 'orange', CLOSED: 'neutral' };
export const STAGE_ORDER: ProjectStage[] = ['DESIGN', 'SITE', 'CLOSED'];

export const DESIGN_LABEL: Record<DesignStage, string> = {
  NOT_STARTED: 'Design not started',
  IN_DESIGN: 'In design',
  SHARED: 'Design shared',
  APPROVED: 'Design approved',
};
export const DESIGN_TONE: Record<DesignStage, Tone> = {
  NOT_STARTED: 'neutral',
  IN_DESIGN: 'info',
  SHARED: 'warning',
  APPROVED: 'success',
};
