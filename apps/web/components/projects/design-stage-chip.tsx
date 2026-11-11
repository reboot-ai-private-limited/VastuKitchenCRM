import type { DesignStage } from '@vastu/contracts';
import { StatusBadge } from '@/components/common/status-badge';
import { DESIGN_STAGE_LABEL } from '@/lib/projects';

const TONE = {
  NOT_STARTED: 'neutral',
  IN_DESIGN: 'violet',
  SHARED: 'warning',
  APPROVED: 'success',
} as const;

export const DesignStageChip = ({ value }: { value: DesignStage }) => (
  <StatusBadge kind="tone" tone={TONE[value]} label={DESIGN_STAGE_LABEL[value]} />
);
