import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import type { ComplaintDto } from '@vastu/contracts';
import { Badge } from '@/components/ui/badge';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, font, radius, space, tone } from '@/constants/theme';
import { formatDate, formatTime } from '@/lib/format';
import { COMPLAINT_STATUS_LABEL, COMPLAINT_STATUS_TONE } from './project-meta';

/** One complaint as it appears in the chat and on the Complaints page. */
export function ComplaintCard({
  complaint,
  onPress,
}: {
  complaint: ComplaintDto;
  onPress: () => void;
}) {
  const thumb = complaint.images[0];
  const raiser = complaint.raisedBy?.name ?? complaint.customer.name;
  return (
    <PressableScale onPress={onPress} accessibilityLabel="Open complaint">
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text variant="label" color={colors.inkDeep} numberOfLines={1} style={styles.author}>
            {raiser}
          </Text>
          <Text variant="caption" color={tone.danger.fg} style={{ fontFamily: font.semibold }}>
            COMPLAINT
          </Text>
        </View>
        <View style={styles.tagRow}>
          <Badge
            label={COMPLAINT_STATUS_LABEL[complaint.status]}
            t={COMPLAINT_STATUS_TONE[complaint.status]}
          />
          {complaint.reopenCount > 0 ? (
            <Badge label={`Reopened x${complaint.reopenCount}`} t="warning" />
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', gap: space[2] }}>
          <Text color={colors.inkDeep} numberOfLines={2} style={{ flex: 1 }}>
            {complaint.description}
          </Text>
          {thumb ? (
            <Image source={{ uri: thumb.thumbUrl }} style={styles.thumb} contentFit="cover" />
          ) : null}
        </View>
        <Text variant="caption" color={colors.inkMuted}>
          {complaint.assignedTo ? `Assigned to ${complaint.assignedTo.name} · ` : 'Not assigned · '}
          {formatDate(complaint.createdAt)}, {formatTime(complaint.createdAt)}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tone.danger.bg,
    borderRadius: radius.xl,
    padding: space[3],
    gap: space[2],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  author: {
    flex: 1,
    fontFamily: font.semibold,
  },
  tagRow: { flexDirection: 'row', gap: space[2], alignItems: 'center', flexWrap: 'wrap' },
  thumb: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.muted },
});
