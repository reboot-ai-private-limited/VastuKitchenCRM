import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space } from '@/constants/theme';

/** The pinned action area under a project page, framed like the chat composer. */
export function BottomBar({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  // With the keyboard up the system navigation bar is behind it, so its inset no longer applies.
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const bottom = (keyboardOpen ? 0 : insets.bottom) + space[2];
  return <View style={[styles.bar, { paddingBottom: bottom }]}>{children}</View>;
}

const styles = StyleSheet.create({
  bar: {
    gap: space[2],
    paddingHorizontal: space[3],
    paddingTop: space[2],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
