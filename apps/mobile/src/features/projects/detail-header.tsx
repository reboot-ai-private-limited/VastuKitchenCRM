import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, font, space } from '@/constants/theme';

/** Colour for plain text in the header's context row. */
export const headerMutedText = 'rgba(255, 255, 255, 0.85)';

/** Matches the project workspace's header: back, a two-line title and a context row on teal. */
export function DetailHeader({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  /** The line under the title: who, when, and status badges. */
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
      <StatusBar style="light" />
      <View style={styles.titleRow}>
        <PressableScale
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          style={styles.navBtn}
        >
          <Feather name="arrow-left" size={22} color={colors.primaryForeground} />
        </PressableScale>
        <Text color={colors.primaryForeground} numberOfLines={2} style={styles.title}>
          {title}
        </Text>
        <View style={styles.navBtn} />
      </View>
      {children ? <View style={styles.contextRow}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.primary,
    paddingBottom: 12,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: space[1],
  },
  navBtn: { width: 40, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    fontFamily: font.semibold,
    paddingTop: 7,
    paddingHorizontal: 2,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[2],
    paddingLeft: 46,
    paddingRight: space[4],
  },
});
