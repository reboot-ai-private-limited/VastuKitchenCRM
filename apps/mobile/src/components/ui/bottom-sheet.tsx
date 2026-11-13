import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import type { ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, hit, radius, shadow, space } from '@/constants/theme';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function BottomSheet(props: Props) {
  // A Modal is its own window: give it its own safe-area provider so the insets are real.
  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={props.onClose}
    >
      <SafeAreaProvider>
        <SheetBody {...props} />
      </SafeAreaProvider>
    </Modal>
  );
}

function SheetBody({ onClose, title, subtitle, children, footer }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <>
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.overlay}
        accessibilityViewIsModal
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close sheet"
          accessibilityRole="button"
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space[4] }]}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>
          {title ? (
            <View style={styles.header}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="section">{title}</Text>
                {subtitle ? (
                  <Text variant="caption" muted>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <PressableScale
                onPress={onClose}
                accessibilityLabel="Close"
                style={styles.closeBtn}
              >
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </PressableScale>
            </View>
          ) : null}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.backdrop,
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '88%',
    borderTopWidth: 1,
    borderColor: colors.border,
    ...shadow.sheet,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: space[2],
    paddingBottom: space[1],
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingBottom: space[2],
    gap: space[2],
  },
  closeBtn: {
    width: hit,
    height: hit,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -space[2],
  },
  scroll: { flexGrow: 0 },
  scrollContent: {
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    gap: space[2],
  },
  footer: {
    paddingHorizontal: space[4],
    paddingTop: space[3],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
