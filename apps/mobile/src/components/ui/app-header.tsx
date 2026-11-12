import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, hit, space } from '@/constants/theme';
import { Text } from './text';

/**
 * One header for every pushed screen: status-bar inset + a 48 dp bar with a back arrow and a title.
 * Replaces the native header, which added a second top inset on edge-to-edge Android and left a large gap.
 */
type HeaderProps = { options: { title?: string }; back?: unknown; navigation: { goBack: () => void } };

export function AppHeader({ options, back, navigation }: HeaderProps) {
  const insets = useSafeAreaInsets();
  const title = typeof options.title === 'string' ? options.title : '';
  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        {back ? (
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            style={styles.back}
          >
            <Feather name="arrow-left" size={22} color={colors.primary} />
          </Pressable>
        ) : (
          <View style={{ width: space[4] }} />
        )}
        {title ? (
          <Text variant="section" color={colors.primary} numberOfLines={1} style={{ flex: 1 }}>
            {title}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.background },
  row: { height: 48, flexDirection: 'row', alignItems: 'center', paddingRight: space[4] },
  back: { width: hit, height: hit, alignItems: 'center', justifyContent: 'center' },
});
