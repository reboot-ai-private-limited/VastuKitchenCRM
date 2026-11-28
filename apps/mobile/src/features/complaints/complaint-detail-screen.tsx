import { Fragment, useCallback, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { ComplaintDto, ComplaintEventDto } from '@vastu/contracts';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { PhotoAttachBar } from '@/components/ui/photo-attach-bar';
import { PhotoGrid } from '@/components/ui/photo-grid';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { ROLE_LABEL } from '@/constants/roles';
import { colors, font, hit, radius, space, tone, type Tone } from '@/constants/theme';
import { BottomBar } from '@/features/projects/bottom-bar';
import { dayLabel } from '@/features/projects/chat-stream';
import { CommentCard } from '@/features/projects/comment-card';
import { DetailHeader, headerMutedText } from '@/features/projects/detail-header';
import { MessageBar } from '@/features/projects/message-bar';
import { SheetRow } from '@/features/projects/sheet-row';
import { useDocUpload } from '@/features/projects/use-doc-upload';
import { SlidingSwitch } from '@/features/projects/sliding-switch';
import {
  DaySeparator,
  TimelineEntryHeader,
  TimelineEntryRow,
  TimelineEventRow,
} from '@/features/projects/timeline-item';
import { ApiError, NetworkError } from '@/lib/api/client';
import { signCommentUpload, signResolveUpload } from '@/lib/api/endpoints/complaints';
import { listUsers } from '@/lib/api/endpoints/users';
import { useSession } from '@/lib/auth/session';
import { businessDate, formatDate, formatTime } from '@/lib/format';
import { STATUS_LABEL, STATUS_TONE } from './complaint-meta';
import { complaintTimeline } from './complaint-timeline';
import {
  useAssignComplaint,
  useComplaintAction,
  useComplaintDetail,
  useDeleteComplaintComment,
  type ComplaintAction,
} from './use-complaints';
import { useSignedAttachments } from './use-signed-attachments';

const ACTION_LABEL: Record<ComplaintAction, string> = {
  comment: 'Send',
  resolve: 'Mark resolved',
  reopen: 'Reopen',
  close: 'Close complaint',
};
const ACTION_HINT: Record<ComplaintAction, string> = {
  comment: 'Write a message',
  resolve: 'What was done to fix it? (required)',
  reopen: 'Why is it being reopened? (required)',
  close: 'Closing note (optional)',
};
const MODE_OPTION = {
  comment: { value: 'comment', label: 'Message', icon: 'message-circle' },
  resolve: { value: 'resolve', label: 'Resolve', icon: 'check-circle' },
  reopen: { value: 'reopen', label: 'Reopen', icon: 'rotate-ccw' },
  close: { value: 'close', label: 'Close', icon: 'archive' },
} as const;

/** How a status change reads in the timeline. Assignments are routine, so they get one line. */
const EVENT_CARD: Record<
  'RESOLVED' | 'REOPENED' | 'CLOSED',
  { tag: string; verb: string; t: Tone }
> = {
  RESOLVED: { tag: 'RESOLVED', verb: 'resolved this complaint', t: 'success' },
  REOPENED: { tag: 'REOPENED', verb: 'reopened this complaint', t: 'warning' },
  CLOSED: { tag: 'CLOSED', verb: 'closed this complaint', t: 'neutral' },
};

function StatusEntry({
  event,
  note,
  photos,
  mine,
}: {
  event: ComplaintEventDto & { type: 'RESOLVED' | 'REOPENED' | 'CLOSED' };
  note: string | null;
  photos: ComplaintDto['resolutionImages'];
  mine: boolean;
}) {
  const meta = EVENT_CARD[event.type];
  const actor = event.actor?.name ?? 'System';
  return (
    <TimelineEntryRow authorName={actor} accentAvatar={mine}>
      <TimelineEntryHeader text={`${actor} ${meta.verb}`} meta={formatTime(event.at)} />
      <View style={[styles.eventCard, { backgroundColor: tone[meta.t].bg }]}>
        <Text variant="caption" color={tone[meta.t].fg} style={{ fontFamily: font.semibold }}>
          {meta.tag}
        </Text>
        {note ? <Text color={colors.inkDeep}>{note}</Text> : null}
        <PhotoGrid images={photos} label="Resolution photo" />
      </View>
    </TimelineEntryRow>
  );
}

export function ComplaintDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useSession();
  const q = useComplaintDetail(id);
  const act = useComplaintAction(id);
  const assign = useAssignComplaint(id);
  const delComment = useDeleteComplaintComment(id);
  const [assignOpen, setAssignOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [pickedMode, setMode] = useState<ComplaintAction>('comment');
  const [text, setText] = useState('');
  const scrollRef = useRef<ScrollViewInstance>(null);
  const c = q.data;
  // If someone else moved the complaint on, a picked action may no longer be allowed.
  const mode: ComplaintAction =
    pickedMode !== 'comment' && c && !c.can[pickedMode] ? 'comment' : pickedMode;

  // Resolution photos use the resolver-only ticket; message photos use the complaint-scoped one (assignees need not be project members).
  const sign = useCallback(
    () => (mode === 'resolve' ? signResolveUpload(id) : signCommentUpload(id)),
    [mode, id],
  );
  const photos = useSignedAttachments(sign, 5);
  const docUpload = useDocUpload(c?.projectId, 'CLIENT');
  const canAttach = mode === 'comment' || mode === 'resolve';

  const pickDocs = async () => {
    setDocError(null);
    const problem = await docUpload.pickAndUpload();
    if (problem) setDocError(problem);
  };

  const staffQ = useQuery({
    queryKey: ['users', 'assignees'],
    queryFn: ({ signal }) => listUsers({ page: 1, pageSize: 100 }, signal),
    select: (d) =>
      d.items
        .filter((u) => u.role !== 'CUSTOMER')
        .sort((a, b) => {
          const aTech = a.role === 'TECHNICIAN' ? 0 : 1;
          const bTech = b.role === 'TECHNICIAN' ? 0 : 1;
          if (aTech !== bTech) return aTech - bTech;
          return a.name.localeCompare(b.name);
        }),
    enabled: !!c?.can.assign,
  });

  const hasPhotos = photos.images.length > 0;
  const canSubmit =
    !photos.busy && (mode === 'close' || text.trim().length > 0 || (mode === 'comment' && hasPhotos));

  const submit = () => {
    if (!canSubmit || !photos.uploadsDone) return;
    act.mutate(
      { action: mode, text: text.trim(), images: canAttach ? photos.images : undefined },
      {
        onSuccess: () => {
          setText('');
          photos.clear();
          setMode('comment');
          // The new entry lands at the end of the timeline.
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
        },
      },
    );
  };

  const errorText = act.error
    ? act.error instanceof NetworkError
      ? 'Connection lost. Check your internet and try again.'
      : act.error instanceof ApiError && act.error.status === 409
        ? 'Someone else just updated this. It has been refreshed.'
        : act.error.message
    : null;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  let content;
  if (q.isPending) {
    content = (
      <View style={{ gap: space[3] }}>
        <Skeleton height={70} width="85%" />
        <Skeleton height={140} />
      </View>
    );
  } else if (q.isError || !c) {
    const notFound = q.error instanceof ApiError && (q.error.status === 404 || q.error.status === 403);
    content = (
      <View style={{ gap: space[3], alignItems: 'center', paddingVertical: space[8] }}>
        <Text muted>{notFound ? 'This complaint could not be found.' : 'Could not load this complaint.'}</Text>
        {!notFound ? <Button title="Try again" variant="outline" onPress={() => void q.refetch()} /> : null}
      </View>
    );
  } else {
    const raiser = c.raisedBy?.name ?? c.customer.name;
    const items = complaintTimeline(c);
    content = (
      <Reveal style={{ gap: space[4] }}>
        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Text variant="caption" color={colors.inkMuted}>
              Assigned to
            </Text>
            <Text variant="caption" color={colors.inkDeep} style={{ fontFamily: font.semibold }}>
              {c.assignedTo?.name ?? 'Unassigned'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text variant="caption" color={colors.inkMuted}>
              Raised by
            </Text>
            <Text variant="caption" color={colors.inkDeep}>
              {raiser} · {formatDate(c.createdAt)}
            </Text>
          </View>
          {c.assignedAt ? (
            <View style={styles.detailRow}>
              <Text variant="caption" color={colors.inkMuted}>
                Assigned
              </Text>
              <Text variant="caption" color={colors.inkDeep} style={{ fontVariant: ['tabular-nums'] }}>
                {formatDate(c.assignedAt)}
              </Text>
            </View>
          ) : null}
          {c.resolvedAt ? (
            <View style={styles.detailRow}>
              <Text variant="caption" color={colors.inkMuted}>
                Resolved
              </Text>
              <Text variant="caption" color={colors.inkDeep} style={{ fontVariant: ['tabular-nums'] }}>
                {formatDate(c.resolvedAt)}
              </Text>
            </View>
          ) : null}
          {c.closedAt ? (
            <View style={styles.detailRow}>
              <Text variant="caption" color={colors.inkMuted}>
                Closed
              </Text>
              <Text variant="caption" color={colors.inkDeep} style={{ fontVariant: ['tabular-nums'] }}>
                {formatDate(c.closedAt)}
              </Text>
            </View>
          ) : null}
        </View>

        {c.can.assign ? (
          <SheetRow
            icon="user-plus"
            label={c.assignedTo ? 'Reassign' : 'Assign'}
            caption={c.assignedTo ? `Assigned to ${c.assignedTo.name}` : 'Not assigned yet'}
            surface
            showChevron
            onPress={() => setAssignOpen(true)}
          />
        ) : null}

        <View>
          <DaySeparator label={dayLabel(c.createdAt)} />
          <View style={styles.item}>
            <TimelineEntryRow authorName={raiser} accentAvatar={c.raisedBy?.id === user?.id}>
              <TimelineEntryHeader text={`${raiser} raised a complaint`} meta={formatTime(c.createdAt)} />
              <View style={[styles.eventCard, { backgroundColor: tone.danger.bg }]}>
                <Text variant="caption" color={tone.danger.fg} style={{ fontFamily: font.semibold }}>
                  COMPLAINT
                </Text>
                <Text color={colors.inkDeep}>{c.description}</Text>
                <PhotoGrid images={c.images} label="Complaint photo" />
              </View>
            </TimelineEntryRow>
          </View>

          {items.map((item, i) => {
            const previousAt = items[i - 1]?.at ?? c.createdAt;
            const newDay = businessDate(previousAt) !== businessDate(item.at);
            let row;
            if (item.type === 'comment') {
              const m = item.comment;
              row = (
                <TimelineEntryRow authorName={m.author.name} accentAvatar={m.author.id === user?.id}>
                  <CommentCard
                    author={m.author.name}
                    isCustomer={m.author.isCustomer}
                    at={m.createdAt}
                    text={m.text}
                    {...(m.canDelete ? { onDelete: () => delComment.mutate(m.id) } : {})}
                    deleting={delComment.isPending}
                  >
                    <PhotoGrid images={m.images} label={`Photo from ${m.author.name}`} />
                  </CommentCard>
                </TimelineEntryRow>
              );
            } else {
              const e = item.event;
              if (e.type === 'RESOLVED' || e.type === 'REOPENED' || e.type === 'CLOSED') {
                row = (
                  <StatusEntry
                    event={{ ...e, type: e.type }}
                    note={item.isResolution ? (c.resolutionNote ?? e.note) : e.note}
                    photos={item.isResolution ? c.resolutionImages : []}
                    mine={e.actor?.id === user?.id}
                  />
                );
              } else {
                const actor = e.actor?.name ?? 'System';
                row = (
                  <TimelineEventRow
                    text={`${actor} assigned this${e.assignee ? ` to ${e.assignee.name}` : ''}`}
                    at={e.at}
                    highlighted
                  />
                );
              }
            }
            return (
              <Fragment key={item.key}>
                {newDay ? <DaySeparator label={dayLabel(item.at)} /> : null}
                <View style={styles.item}>{row}</View>
              </Fragment>
            );
          })}

          {delComment.isError ? (
            <Text variant="caption" color={colors.destructive}>
              {delComment.error.message}
            </Text>
          ) : null}
        </View>
      </Reveal>
    );
  }

  const actions = c ? (['resolve', 'reopen', 'close'] as const).filter((a) => c.can[a]) : [];
  const canOpenProject = !!c && user?.role !== 'TECHNICIAN';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={styles.root} behavior="padding">
        <DetailHeader
          title={c?.projectName ?? 'Complaint'}
          onBack={goBack}
          right={
            canOpenProject ? (
              <PressableScale
                onPress={() =>
                  router.push({ pathname: '/projects/[id]', params: { id: c.projectId } } as Href)
                }
                accessibilityRole="button"
                accessibilityLabel="Open project"
                style={styles.openProjectBtn}
              >
                <Feather name="external-link" size={16} color={colors.primaryForeground} />
              </PressableScale>
            ) : undefined
          }
        >
          {c ? (
            <>
              <Text variant="caption" color={headerMutedText} numberOfLines={1} style={{ flexShrink: 1 }}>
                {c.customer.name} · {formatDate(c.createdAt)}
                {c.assignedTo && !c.can.assign ? ` · ${c.assignedTo.name}` : ''}
              </Text>
              <Badge label={STATUS_LABEL[c.status]} t={STATUS_TONE[c.status]} />
              {c.reopenCount > 0 ? <Badge label={`Reopened x${c.reopenCount}`} t="warning" /> : null}
            </>
          ) : null}
        </DetailHeader>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: space[4], paddingBottom: space[6] }}
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>
        {c && c.status !== 'CLOSED' ? (
          <BottomBar>
            {actions.length > 0 ? (
              <SlidingSwitch<ComplaintAction>
                options={[MODE_OPTION.comment, ...actions.map((a) => MODE_OPTION[a])]}
                value={mode}
                onChange={setMode}
                disabled={act.isPending}
              />
            ) : null}
            {canAttach ? (
              <PhotoAttachBar
                items={photos.items}
                problem={photos.problem}
                onCamera={() => void photos.takePhoto()}
                onGallery={() => void photos.pickFromGallery()}
                onRemove={photos.remove}
                onRetry={photos.retry}
                hideActions
              />
            ) : null}
            {docUpload.progress ? (
              <Text variant="caption" color={colors.primaryPressed}>
                {docUpload.progress}
              </Text>
            ) : null}
            <MessageBar
              value={text}
              onChangeText={setText}
              placeholder={ACTION_HINT[mode]}
              error={docError ?? errorText}
              {...(canAttach ? { onAttach: () => setAttachOpen(true) } : {})}
              {...(mode === 'comment'
                ? { onSend: submit, canSend: canSubmit && photos.uploadsDone, sending: act.isPending }
                : {})}
            />
            {mode !== 'comment' ? (
              // A status change is named on its button, so it is never sent by a bare arrow.
              <Button
                title={ACTION_LABEL[mode]}
                loading={act.isPending}
                disabled={!canSubmit || !photos.uploadsDone}
                onPress={submit}
                fullWidth
              />
            ) : null}
          </BottomBar>
        ) : null}
      </KeyboardAvoidingView>

      <BottomSheet visible={attachOpen} onClose={() => setAttachOpen(false)} title="Add attachment">
        <View>
          <SheetRow
            icon="camera"
            label="Take photo"
            onPress={() => {
              setAttachOpen(false);
              void photos.takePhoto();
            }}
          />
          <SheetRow
            icon="image"
            label="Choose from gallery"
            divider
            onPress={() => {
              setAttachOpen(false);
              void photos.pickFromGallery();
            }}
          />
          {c?.projectId ? (
            <SheetRow
              icon="file-text"
              label="Upload document"
              caption="PDF, Word, Excel, CAD · saved to project Docs"
              divider
              onPress={() => {
                setAttachOpen(false);
                void pickDocs();
              }}
            />
          ) : null}
        </View>
      </BottomSheet>

      <BottomSheet
        visible={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Assign to"
        subtitle="Pick an active staff member"
      >
        {staffQ.isPending ? <Skeleton height={80} /> : null}
        {staffQ.isError ? <Text muted>Could not load staff. Try again.</Text> : null}
        {(staffQ.data ?? []).map((u) => {
          const selected = c?.assignedTo?.id === u.id;
          return (
            <PressableScale
              key={u.id}
              onPress={() =>
                assign.mutate(u.id, {
                  onSuccess: () => setAssignOpen(false),
                  onError: (err) => {
                    if (err instanceof ApiError && err.status === 409) {
                      setAssignOpen(false);
                      Alert.alert(
                        'Complaint updated',
                        'Someone else just updated this complaint. It has been refreshed.',
                      );
                    }
                  },
                })
              }
              disabled={assign.isPending || selected}
              accessibilityRole="button"
              accessibilityLabel={`Assign to ${u.name}`}
              accessibilityState={{ selected, disabled: assign.isPending || selected }}
              style={[styles.person, selected && styles.personSelected]}
            >
              <Avatar name={u.name} size={32} accent={selected} />
              <View style={{ flex: 1 }}>
                <Text variant="label" color={colors.inkDeep}>
                  {u.name}
                </Text>
                <Text variant="caption" color={colors.inkMuted}>
                  {u.designation ?? ROLE_LABEL[u.role]}
                </Text>
              </View>
            </PressableScale>
          );
        })}
        {assign.isError ? (
          <Text variant="caption" color={colors.destructive}>
            {assign.error.message}
          </Text>
        ) : null}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageSoft },
  item: { marginVertical: space[2] },
  eventCard: { borderRadius: radius.xl, padding: space[3], gap: space[2] },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: hit,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  personSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  openProjectBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
});
