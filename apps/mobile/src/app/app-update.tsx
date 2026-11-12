import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { colors, space } from '@/constants/theme';
import { refreshAppConfig, useAppConfigState, useAppGate } from '@/lib/app-config';

/**
 * Full-screen block for the two cases the server can raise: this build is below the minimum version
 * (force update) or maintenance mode is on. The root layout routes here and back out again as soon
 * as a fresh config says the block is over.
 */
export default function AppUpdateScreen() {
  const gate = useAppGate();
  const { config, forced } = useAppConfigState();
  const [checking, setChecking] = useState(false);

  const recheck = async () => {
    setChecking(true);
    await refreshAppConfig();
    setChecking(false);
  };

  if (gate === 'maintenance') {
    return (
      <View style={styles.root}>
        <Text variant="title" style={styles.center}>
          Back soon
        </Text>
        <Text muted style={styles.center}>
          {config?.maintenance.message ||
            'We are updating the system. Please try again in a few minutes.'}
        </Text>
        <Button title="Try again" onPress={() => void recheck()} loading={checking} fullWidth />
      </View>
    );
  }

  const url = forced?.storeUrl ?? forced?.apkUrl ?? config?.storeUrl ?? config?.apkUrl ?? null;
  return (
    <View style={styles.root}>
      <Text variant="title" style={styles.center}>
        Please update the app
      </Text>
      <Text muted style={styles.center}>
        This version is no longer supported
        {forced?.minVersion ? ` (version ${forced.minVersion} or newer is needed)` : ''}. Update to
        keep using Vastu Kitchen.
      </Text>
      {url ? (
        <Button title="Update now" onPress={() => void Linking.openURL(url)} fullWidth />
      ) : null}
      <Button
        title="I have updated"
        variant="ghost"
        onPress={() => void recheck()}
        loading={checking}
        fullWidth
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[4],
    padding: space[6],
    backgroundColor: colors.background,
  },
  center: { textAlign: 'center' },
});
