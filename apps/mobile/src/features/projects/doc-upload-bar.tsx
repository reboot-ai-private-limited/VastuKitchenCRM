import { useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { colors, space } from '@/constants/theme';
import { useDocUpload } from './use-doc-upload';

/** "Upload documents" button. Staff choose whether the client can see the files; customers' files are always shared. */
export function DocUploadBar({ projectId, isCustomer }: { projectId: string | undefined; isCustomer?: boolean }) {
  const [shared, setShared] = useState(false);
  const { pickAndUpload, busy, progress } = useDocUpload(projectId, isCustomer || shared ? 'CLIENT' : 'TEAM');

  const run = () => {
    void pickAndUpload().then((msg) => {
      if (msg) Alert.alert('Some files were not uploaded', msg);
    });
  };

  return (
    <View style={{ gap: space[2] }}>
      <Button
        title={busy ? (progress ?? 'Uploading...') : 'Upload documents'}
        onPress={run}
        loading={busy}
        disabled={!projectId}
        fullWidth
      />
      {isCustomer ? null : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="caption" muted>
            {shared ? 'Client can see these files' : 'Team only'}
          </Text>
          <Switch
            value={shared}
            onValueChange={setShared}
            disabled={busy}
            accessibilityLabel="Share uploaded files with the client"
            trackColor={{ true: colors.primary }}
          />
        </View>
      )}
    </View>
  );
}
