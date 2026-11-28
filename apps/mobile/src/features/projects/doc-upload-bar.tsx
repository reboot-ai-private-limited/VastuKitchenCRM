import { useState } from 'react';
import { Alert, View } from 'react-native';
import type { PostVisibility } from '@vastu/contracts';
import { Button } from '@/components/ui/button';
import { space } from '@/constants/theme';
import { AudienceSwitch } from './post-composer';
import { useDocUpload } from './use-doc-upload';

/** "Upload documents" button. Staff choose whether the client can see the files; customers' files are always shared. */
export function DocUploadBar({
  projectId,
  isCustomer,
  folderId,
}: {
  projectId: string | undefined;
  isCustomer?: boolean;
  folderId?: string | null;
}) {
  const [visibility, setVisibility] = useState<PostVisibility>('TEAM');
  const { pickAndUpload, busy, progress } = useDocUpload(
    projectId,
    isCustomer ? 'CLIENT' : visibility,
    folderId,
  );

  const run = () => {
    void pickAndUpload().then((msg) => {
      if (msg) Alert.alert('Some files were not uploaded', msg);
    });
  };

  return (
    <View style={{ gap: space[2] }}>
      {isCustomer ? null : (
        <AudienceSwitch value={visibility} onChange={setVisibility} disabled={busy} />
      )}
      <Button
        title={busy ? (progress ?? 'Uploading...') : 'Upload documents'}
        onPress={run}
        loading={busy}
        disabled={!projectId}
        fullWidth
      />
    </View>
  );
}
