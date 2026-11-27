import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, font, radius, space } from '@/constants/theme';

/** The chat composer's input row: optional attach button, growing input and a round send button. */
export function MessageBar({
  value,
  onChangeText,
  placeholder,
  onAttach,
  onSend,
  canSend = false,
  sending = false,
  error,
}: {
  value: string;
  onChangeText: (next: string) => void;
  placeholder: string;
  onAttach?: () => void;
  /** Leave out when the caller submits with its own button. */
  onSend?: () => void;
  canSend?: boolean;
  sending?: boolean;
  error?: string | null;
}) {
  return (
    <View style={{ gap: space[2] }}>
      {error ? (
        <Text variant="caption" color={colors.destructive} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <View style={styles.row}>
        {onAttach ? (
          <PressableScale
            onPress={onAttach}
            accessibilityRole="button"
            accessibilityLabel="Add attachment"
            style={styles.attach}
          >
            <Feather name="plus" size={20} color={colors.inkDeep} />
          </PressableScale>
        ) : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          accessibilityLabel={placeholder}
          multiline
          style={styles.input}
        />
        {onSend ? (
          <PressableScale
            onPress={onSend}
            disabled={!canSend || sending}
            accessibilityRole="button"
            accessibilityLabel="Send"
            style={[styles.send, { opacity: canSend ? 1 : 0.4 }]}
          >
            {sending ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Feather name="send" size={19} color={colors.primaryForeground} />
            )}
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space[2] },
  attach: {
    width: 40,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.background,
    fontFamily: font.regular,
    fontSize: 16,
    color: colors.foreground,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
