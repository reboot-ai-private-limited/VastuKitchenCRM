import { Screen } from '@/components/ui/screen';
import { MoreMenuContent } from './more-sheet';

export function MoreScreen() {
  return (
    <Screen title="More" subtitle="Tools, directories and account settings">
      <MoreMenuContent />
    </Screen>
  );
}
