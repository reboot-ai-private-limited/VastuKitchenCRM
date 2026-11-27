import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, font, hit, radius, space } from '@/constants/theme';
import { formatTime } from '@/lib/format';

/** A reply as the chat's discussion shows it: name and time over the message, then any photos. */
export function CommentCard({
  author,
  isCustomer = false,
  at,
  text,
  onDelete,
  deleting = false,
  children,
}: {
  author: string;
  isCustomer?: boolean;
  at: string;
  text: string | null;
  /** Given only when this viewer may delete the message. */
  onDelete?: () => void;
  deleting?: boolean;
  children?: ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text variant="label" color={colors.inkDeep} numberOfLines={1} style={styles.author}>
          {author}
          {isCustomer ? ' · Customer' : ''}
        </Text>
        <Text variant="caption" muted style={styles.time}>
          {formatTime(at)}
        </Text>
      </View>
      {text ? <Text color={colors.inkDeep}>{text}</Text> : null}
      {children}
      {onDelete ? (
        <PressableScale
          onPress={onDelete}
          disabled={deleting}
          accessibilityRole="button"
          accessibilityLabel={`Delete message from ${author}`}
          style={styles.delete}
        >
          <Text variant="caption" color={colors.destructive}>
            Delete
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.xl,
    padding: space[3],
    gap: 6,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  author: { flex: 1, fontFamily: font.semibold },
  time: { fontSize: 11, fontVariant: ['tabular-nums'] },
  delete: { alignSelf: 'flex-start', minHeight: hit, justifyContent: 'center' },
});
