import { useCallback, useEffect, useState } from 'react';
import { Keyboard, ScrollView, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PhotoAttachBar } from '@/components/ui/photo-attach-bar';
import { PhotoGrid } from '@/components/ui/photo-grid';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { ROLE_LABEL } from '@/constants/roles';
import { colors, font, hit, radius, space } from '@/constants/theme';
import { ApiError, NetworkError } from '@/lib/api/client';
import { signResolveUpload } from '@/lib/api/endpoints/complaints';
import { listUsers } from '@/lib/api/endpoints/users';
import { signProjectUpload } from '@/lib/api/upload';
import { timeAgo } from '@/lib/format';
import { EVENT_LABEL, STATUS_LABEL, STATUS_TONE } from './complaint-meta';
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

export function ComplaintDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const q = useComplaintDetail(id);
  const act = useComplaintAction(id);
  const assign = useAssignComplaint(id);
  const delComment = useDeleteComplaintComment(id);
  const [assignOpen, setAssignOpen] = useState(false);
  const [mode, setMode] = useState<ComplaintAction>('comment');
  const [text, setText] = useState('');
  const c = q.data;
  const projectId = c?.projectId;
  const [kbOpen, setKbOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKbOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Resolution photos use the complaint's own ticket (resolver only); comment photos use the project's.
  const sign = useCallback(
    () => (mode === 'resolve' ? signResolveUpload(id) : signProjectUpload(projectId ?? '')),
    [mode, id, projectId],
  );
  const photos = useSignedAttachments(sign, 5);
  const canAttach = mode === 'comment' || mode === 'resolve';

  const staffQ = useQuery({
    queryKey: ['users', 'assignees'],
    queryFn: ({ signal }) => listUsers({ page: 1, pageSize: 100 }, signal),
    select: (d) => d.items.filter((u) => u.role !== 'CUSTOMER'),
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

  let content;
  if (q.isPending) {
    content = (
      <View style={{ gap: space[3] }}>
        <Skeleton height={28} width="60%" />
        <Skeleton height={120} />
      </View>
    );
  } else if (q.isError || !c) {
    const notFound = q.error instanceof ApiError && (q.error.status === 404 || q.error.status === 403);
    content = (
      <View style={{ gap: space[3], alignItems: 'center', paddingVertical: space[8] }}>
        <Text muted>{notFound ? 'This complaint could not be found.' : 'Could not load this complaint.'}</Text>
        {!notFound ? <Button title="Retry" variant="outline" onPress={() => void q.refetch()} /> : null}
      </View>
    );
  } else {
    const actions = (['resolve', 'reopen', 'close'] as const).filter((a) => c.can[a]);
    content = (
      <Reveal style={{ gap: space[5] }}>
        <View style={{ gap: space[2] }}>
          <Text variant="title">{c.projectName}</Text>
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <Badge label={STATUS_LABEL[c.status]} t={STATUS_TONE[c.status]} />
            {c.reopenCount > 0 ? <Badge label={`Reopened ${c.reopenCount}x`} t="orange" /> : null}
          </View>
          <Text variant="caption" muted>
            {c.customer.name} · raised {timeAgo(c.createdAt)}
            {c.assignedTo ? ` · assigned to ${c.assignedTo.name}` : ''}
          </Text>
        </View>

        <Card style={{ gap: space[2] }}>
          <Text>{c.description}</Text>
          <PhotoGrid images={c.images} label="Complaint photo" />
        </Card>

        {c.resolutionNote ? (
          <Card style={{ gap: space[2] }}>
            <Text variant="caption" muted>
              Resolution
            </Text>
            <Text>{c.resolutionNote}</Text>
            <PhotoGrid images={c.resolutionImages} label="Resolution photo" />
          </Card>
        ) : null}

        {actions.length > 0 || c.can.assign ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            {c.can.assign ? (
              <Button
                title={c.assignedTo ? 'Reassign' : 'Assign'}
                size="sm"
                variant="outline"
                onPress={() => setAssignOpen(true)}
              />
            ) : null}
            {actions.map((a) => (
              <Button
                key={a}
                title={ACTION_LABEL[a]}
                size="sm"
                variant={mode === a ? 'default' : 'outline'}
                onPress={() => setMode(mode === a ? 'comment' : a)}
              />
            ))}
          </View>
        ) : null}

        <View style={{ gap: space[3] }}>
          <Text variant="section">Conversation</Text>
          {c.comments.length === 0 ? <Text muted>No messages yet.</Text> : null}
          {c.comments.map((m) => (
            <Card key={m.id} style={{ gap: space[1] }}>
              <View style={{ flexDirection: 'row', gap: space[2] }}>
                <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>
                  {m.author.name}
                </Text>
                <Text variant="caption" muted>
                  {timeAgo(m.createdAt)}
                </Text>
              </View>
              {m.text ? <Text>{m.text}</Text> : null}
              <PhotoGrid images={m.images} label={`Photo from ${m.author.name}`} />
              {m.canDelete ? (
                <PressableScale
                  onPress={() => delComment.mutate(m.id)}
                  disabled={delComment.isPending}
                  accessibilityLabel={`Delete message from ${m.author.name}`}
                  style={{ alignSelf: 'flex-start', minHeight: hit, justifyContent: 'center' }}
                >
                  <Text variant="caption" color={colors.destructive}>
                    Delete
                  </Text>
                </PressableScale>
              ) : null}
            </Card>
          ))}
          {delComment.isError ? (
            <Text variant="caption" color={colors.destructive}>
              {delComment.error.message}
            </Text>
          ) : null}
        </View>

        <View style={{ gap: space[3] }}>
          <Text variant="section">History</Text>
          {c.history.map((h, i) => (
            <Text key={i} variant="caption" muted>
              {EVENT_LABEL[h.type]} · {h.actor?.name ?? 'System'} · {timeAgo(h.at)}
              {h.type === 'ASSIGNED' && h.assignee ? ` · to ${h.assignee.name}` : ''}
              {h.note && !(h.type === 'ASSIGNED' && h.assignee) ? ` · ${h.note}` : ''}
            </Text>
          ))}
        </View>
      </Reveal>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: '', headerShadowVisible: false, headerTintColor: colors.primary }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior="padding"
      >
        <ScrollView
          contentContainerStyle={{ padding: space[4], paddingTop: space[1], paddingBottom: space[6], gap: space[5] }}
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>
        {c ? (
          <View
            style={{
              padding: space[3],
              paddingBottom: (kbOpen ? 0 : insets.bottom) + space[3],
              gap: space[2],
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            {errorText ? (
              <Text variant="caption" color={colors.destructive} accessibilityRole="alert">
                {errorText}
              </Text>
            ) : null}
            {canAttach ? (
              <PhotoAttachBar
                items={photos.items}
                problem={photos.problem}
                onCamera={() => void photos.takePhoto()}
                onGallery={() => void photos.pickFromGallery()}
                onRemove={photos.remove}
                onRetry={photos.retry}
              />
            ) : null}
            <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'flex-end' }}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={ACTION_HINT[mode]}
                placeholderTextColor={colors.placeholder}
                accessibilityLabel={ACTION_HINT[mode]}
                multiline
                style={{
                  flex: 1,
                  minHeight: hit,
                  maxHeight: 120,
                  paddingHorizontal: space[3],
                  paddingVertical: space[2],
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.input,
                  fontFamily: font.regular,
                  fontSize: 16,
                  color: colors.foreground,
                }}
              />
              <Button
                title={mode === 'comment' ? 'Send' : 'Submit'}
                loading={act.isPending}
                disabled={!canSubmit}
                onPress={submit}
              />
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <BottomSheet
        visible={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Assign to"
        subtitle="Pick an active staff member"
      >
        {staffQ.isPending ? <Skeleton height={80} /> : null}
        {staffQ.isError ? <Text muted>Could not load staff. Try again.</Text> : null}
        {(staffQ.data ?? []).map((u) => (
          <PressableScale
            key={u.id}
            onPress={() => assign.mutate(u.id, { onSuccess: () => setAssignOpen(false) })}
            disabled={assign.isPending}
            accessibilityLabel={`Assign to ${u.name}`}
            accessibilityState={{ selected: c?.assignedTo?.id === u.id }}
            style={{ minHeight: hit, justifyContent: 'center' }}
          >
            <Text variant="label">{u.name}</Text>
            <Text variant="caption" muted>
              {u.designation ?? ROLE_LABEL[u.role]}
            </Text>
          </PressableScale>
        ))}
        {assign.isError ? (
          <Text variant="caption" color={colors.destructive}>
            {assign.error.message}
          </Text>
        ) : null}
      </BottomSheet>
    </>
  );
}
