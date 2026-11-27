import { StyleSheet, View } from 'react-native';
import type { ComplaintDto } from '@vastu/contracts';
import { Badge } from '@/components/ui/badge';
import { PhotoGrid } from '@/components/ui/photo-grid';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, font, radius, space, tone } from '@/constants/theme';
import { formatTime } from '@/lib/format';
import { COMPLAINT_STATUS_LABEL, COMPLAINT_STATUS_TONE } from './project-meta';

/** One complaint as it appears in the chat and on the Complaints page. */
export function ComplaintCard({
  complaint,
  mine = false,
  onPress,
}: {
  complaint: ComplaintDto;
  /** The viewer raised it. */
  mine?: boolean;
  onPress: () => void;
}) {
  const raiser = mine ? 'You' : (complaint.raisedBy?.name ?? complaint.customer.name);
  return (
    <View style={styles.card}>
      <PressableScale onPress={onPress} accessibilityLabel="Open complaint" style={{ gap: space[2] }}>
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
        <Text color={colors.inkDeep} numberOfLines={3}>
          {complaint.description}
        </Text>
      </PressableScale>
      {complaint.images.length > 0 ? (
        <PhotoGrid images={complaint.images} label="Complaint photo" />
      ) : null}
      <PressableScale onPress={onPress} accessibilityLabel="Open complaint">
        <Text variant="caption" color={colors.inkMuted}>
          {complaint.assignedTo ? `Assigned to ${complaint.assignedTo.name} · ` : 'Not assigned · '}
          {formatTime(complaint.createdAt)}
        </Text>
      </PressableScale>
    </View>
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
});
