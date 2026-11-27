import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { PostVisibility } from '@vastu/contracts';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, font, radius, space, tone, type Tone } from '@/constants/theme';
import { formatTime } from '@/lib/format';
import type { FileBatchEntry } from './chat-stream';
import { AUDIENCE_TONE } from './project-meta';

export const TIMELINE_RAIL_W = 36;

/**
 * Routine timeline event (assignment, status change, file share, to-do tick):
 * a small dot in the left rail and one compact line in the shared content column.
 */
export function TimelineEventRow({
  text,
  at,
  dotColor = colors.input,
  highlighted = false,
  highlightTone = 'accent',
  connectAbove = false,
  connectBelow = false,
  onPress,
}: {
  text: string;
  at?: string;
  dotColor?: string;
  highlighted?: boolean;
  highlightTone?: Tone;
  connectAbove?: boolean;
  connectBelow?: boolean;
  onPress?: () => void;
}) {
  const hl = tone[highlightTone];
  const resolvedDot = highlighted ? hl.fg : dotColor;
  const inner = (
    <View style={styles.row}>
      <View style={[styles.rail, highlighted && { paddingTop: 11 }]}>
        {connectAbove ? <View style={styles.railLineTop} /> : null}
        <View style={[styles.dot, { backgroundColor: resolvedDot }, highlighted && styles.dotHighlighted]} />
        {connectBelow ? <View style={styles.railLineBottom} /> : null}
      </View>
      <View
        style={[
          styles.eventContent,
          highlighted && [styles.eventHighlighted, { backgroundColor: hl.bg }],
        ]}
      >
        <Text
          variant="caption"
          color={highlighted ? colors.inkDeep : colors.inkMuted}
          numberOfLines={highlighted ? 2 : 1}
          style={[{ flex: 1 }, highlighted && { fontFamily: font.medium }]}
        >
          {text}
        </Text>
        {at ? (
          <Text variant="caption" color={highlighted ? hl.fg : colors.mutedForeground} style={styles.time}>
            {formatTime(at)}
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (!onPress) return inner;
  return (
    <PressableScale onPress={onPress} accessibilityRole="button">
      {inner}
    </PressableScale>
  );
}

/**
 * Authored timeline entry (post, photo update, file upload):
 * author avatar in the left rail, everything else aligned in one content column.
 */
export function TimelineEntryRow({
  authorName,
  accentAvatar = false,
  connectAbove = false,
  connectBelow = false,
  children,
}: {
  authorName: string;
  accentAvatar?: boolean;
  connectAbove?: boolean;
  connectBelow?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.avatarRail}>
        {connectAbove ? <View style={styles.avatarLineTop} /> : null}
        <Avatar name={authorName} size={32} accent={accentAvatar} />
        {connectBelow ? <View style={styles.avatarLineBottom} /> : null}
      </View>
      <View style={styles.entryContent}>{children}</View>
    </View>
  );
}

/** `— Today —` between the days of a timeline. */
export function DaySeparator({ label }: { label: string }) {
  return (
    <View style={styles.day}>
      <View style={styles.dayLine} />
      <Text variant="caption" muted style={styles.dayText}>
        {label}
      </Text>
      <View style={styles.dayLine} />
    </View>
  );
}

/** The line above an entry's content: what happened, and when. */
export function TimelineEntryHeader({ text, meta }: { text: string; meta: string }) {
  return (
    <View style={styles.entryHeader}>
      <Text variant="caption" color={colors.inkMuted} style={{ flex: 1 }}>
        {text}
      </Text>
      <Text variant="caption" muted style={styles.time}>
        {meta}
      </Text>
    </View>
  );
}

export type TimelineFile = FileBatchEntry & {
  /** Second line, e.g. `PDF · 2 KB`. */
  meta?: string;
  thumbUrl?: string | null;
  /** Who can see it; shown as a badge. */
  audience?: PostVisibility;
  highlighted?: boolean;
};

/** Compact file attachment rows with document/PDF icon and filename. */
export function TimelineFileRows({
  files,
  onOpenFile,
}: {
  files: TimelineFile[];
  onOpenFile: (fileId?: string) => void;
}) {
  if (files.length === 0) return null;
  return (
    <View style={styles.filesList}>
      {files.map((f, idx) => {
        const isPdf = /\.pdf$/i.test(f.name);
        const isImg = /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name);
        const iconName = isImg ? 'image' : 'file-text';
        const iconTone = isPdf ? tone.danger : isImg ? tone.info : tone.accent;
        return (
          <PressableScale
            key={f.activityId}
            onPress={() => onOpenFile(f.fileId ?? undefined)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${f.name}`}
            style={[
              styles.fileRow,
              idx > 0 && styles.fileRowBorder,
              f.highlighted && { backgroundColor: tone.success.bg },
            ]}
          >
            {f.thumbUrl ? (
              <Image source={{ uri: f.thumbUrl }} style={styles.fileIcon} contentFit="cover" />
            ) : (
              <View style={[styles.fileIcon, { backgroundColor: iconTone.bg }]}>
                <Feather name={iconName} size={14} color={iconTone.fg} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text variant="caption" color={colors.inkDeep} numberOfLines={1} style={styles.fileName}>
                {f.name}
              </Text>
              {f.meta ? (
                <Text variant="caption" muted numberOfLines={1} style={styles.time}>
                  {f.meta}
                </Text>
              ) : null}
            </View>
            {f.audience ? (
              <Badge label={f.audience === 'CLIENT' ? 'Shared' : 'Team'} t={AUDIENCE_TONE[f.audience]} />
            ) : isPdf ? (
              <Text variant="caption" color={tone.danger.fg} style={styles.pdfTag}>
                PDF
              </Text>
            ) : null}
            <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: space[2],
  },
  rail: {
    width: TIMELINE_RAIL_W,
    alignItems: 'center',
    paddingTop: 6,
  },
  railLineTop: {
    position: 'absolute',
    top: 0,
    height: 6,
    width: 1,
    backgroundColor: colors.cardBorder,
  },
  railLineBottom: {
    flex: 1,
    width: 1,
    marginTop: 4,
    backgroundColor: colors.cardBorder,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotHighlighted: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  eventHighlighted: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: 6,
  },
  avatarRail: {
    width: TIMELINE_RAIL_W,
    alignItems: 'center',
    paddingTop: 1,
  },
  avatarLineTop: {
    position: 'absolute',
    top: 0,
    height: 2,
    width: 1,
    backgroundColor: colors.cardBorder,
  },
  avatarLineBottom: {
    flex: 1,
    width: 1,
    marginTop: 4,
    backgroundColor: colors.cardBorder,
  },
  eventContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space[2],
    paddingVertical: 1,
  },
  entryContent: {
    flex: 1,
    gap: 6,
  },
  time: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  day: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[2],
  },
  dayLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  dayText: {
    fontSize: 11,
    letterSpacing: 0.3,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space[2],
  },
  filesList: {
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[3],
    paddingVertical: 9,
  },
  fileRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
  },
  fileIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileName: {
    fontFamily: font.medium,
  },
  pdfTag: {
    fontSize: 10,
    fontFamily: font.semibold,
    letterSpacing: 0.4,
  },
});
