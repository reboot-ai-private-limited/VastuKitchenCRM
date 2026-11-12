import { Linking, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, space, tone } from '@/constants/theme';
import { appConfigStore, useAppConfigState } from './store';
import { APP_VERSION } from './use-app-config';
import { isOlder } from './version';

/** Soft "update available" strip: shown while the build is older than recommendedVersion; dismissible. */
export function UpdateBanner() {
  const { config, bannerDismissed } = useAppConfigState();
  const insets = useSafeAreaInsets();
  if (!config || bannerDismissed || !isOlder(APP_VERSION, config.recommendedVersion)) return null;
  const url = config.storeUrl ?? config.apkUrl;
  return (
    <View style={[styles.bar, { paddingTop: insets.top + space[2] }]} accessibilityRole="alert">
      <Text variant="caption" color={tone.info.fg} style={styles.text}>
        A new version of the app is available.
      </Text>
      {url ? (
        <PressableScale
          accessibilityRole="link"
          accessibilityLabel="Update the app"
          onPress={() => void Linking.openURL(url)}
          style={styles.action}
        >
          <Text variant="caption" color={colors.primary}>
            Update
          </Text>
        </PressableScale>
      ) : null}
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={appConfigStore.dismissBanner}
        style={styles.action}
      >
        <Text variant="caption" color={tone.info.fg}>
          Later
        </Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingBottom: space[2],
    backgroundColor: tone.info.bg,
  },
  text: { flex: 1 },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space[2] },
});
