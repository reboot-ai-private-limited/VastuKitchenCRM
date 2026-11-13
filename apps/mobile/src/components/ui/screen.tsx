import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space } from '@/constants/theme';
import { Text } from './text';
import { Reveal } from './reveal';

export function Screen({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + space[4], paddingBottom: space[8], paddingHorizontal: space[4], gap: space[5] }}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="never"
    >
      <Reveal>
        <View style={{ gap: space[1] }}>
          <Text variant="title">{title}</Text>
          {subtitle ? <Text muted>{subtitle}</Text> : null}
        </View>
      </Reveal>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.background } });
