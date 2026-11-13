import type { StockLevel } from '@vastu/contracts';
import { StatusBadge } from '@/components/common/status-badge';
import { STOCK_LEVEL_LABEL } from '@/lib/stocks';

const TONE = { OK: 'success', LOW: 'warning', OUT: 'danger' } as const;

export const StockLevelBadge = ({ level }: { level: StockLevel }) => (
  <StatusBadge kind="tone" tone={TONE[level]} label={STOCK_LEVEL_LABEL[level]} />
);
