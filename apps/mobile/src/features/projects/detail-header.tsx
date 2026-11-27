import { useCallback, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, font, space } from '@/constants/theme';

/** Colour for plain text in the header's context row. */
export const headerMutedText = 'rgba(255, 255, 255, 0.85)';

/** A 40 x 36 header icon button. */
export const headerButton = {
  width: 40,
  height: 36,
  alignItems: 'center',
  justifyContent: 'center',
} as const;

/** The project header: back, a two-line title, actions and a context row on teal. */
export function DetailHeader({
  title,
  onBack,
  backLabel = 'Go back',
  right,
  children,
}: {
  title: string;
  onBack: () => void;
  backLabel?: string;
  /** Icon buttons after the title, each a `headerButton`. */
  right?: ReactNode;
  /** The line under the title: who, when, and status badges. */
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  // Light icons while this screen is in front and the teal reaches behind them. Tied to focus, not
  // mounting: a screen pushed on top has a white header and needs the dark icons back.
  const behindStatusBar = insets.top > 0;
  useFocusEffect(
    useCallback(() => {
      if (!behindStatusBar) return undefined;
      StatusBar.setStyle('light');
      return () => StatusBar.setStyle('dark');
    }, [behindStatusBar]),
  );
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
      <View style={styles.titleRow}>
        <PressableScale
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          hitSlop={8}
          style={headerButton}
        >
          <Feather name="arrow-left" size={22} color={colors.primaryForeground} />
        </PressableScale>
        <Text color={colors.primaryForeground} numberOfLines={2} style={styles.title}>
          {title}
        </Text>
        {right ?? <View style={headerButton} />}
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
