import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Linking, RefreshControl, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { DocFileDto, ProjectDto, TodoDto } from '@vastu/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, font, radius, space, tone } from '@/constants/theme';
import { useSession } from '@/lib/auth/session';
import { businessDate, formatBytes, formatDate, formatDay, formatTime } from '@/lib/format';
import { BottomBar } from './bottom-bar';
import { dayLabel } from './chat-stream';
import { ComplaintCard } from './complaint-card';
import { DocUploadBar } from './doc-upload-bar';
import type { ViewerPhoto } from './photo-viewer';
import { SlidingSwitch } from './sliding-switch';
import {
  DaySeparator,
  TimelineEntryHeader,
  TimelineEntryRow,
  TimelineFileRows,
} from './timeline-item';
import { useProjectComplaints, useProjectFiles, useProjectTodos } from './use-projects';

const pad = { padding: space[4], flexGrow: 1 } as const;

function Failed({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={{ alignItems: 'center', gap: space[3], paddingVertical: space[8] }}>
      <Text muted>Could not load this. Check your connection.</Text>
      <Button title="Try again" variant="outline" onPress={onRetry} />
    </View>
  );
}

function Loading() {
  return (
    <View style={{ gap: space[3] }}>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} height={70} width={i % 2 ? '70%' : '85%'} />
      ))}
    </View>
  );
}

/** Takes the bottom bar's place of an action on a closed project, as the chat does. */
function ClosedNotice({ text }: { text: string }) {
  return (
    <Text variant="caption" muted style={{ textAlign: 'center', paddingVertical: space[1] }}>
      {text}
    </Text>
  );
}

/* ── To-dos ─────────────────────────────────────────────────────────────────── */

const TODO_FILTERS = [
  { value: 'open', label: 'Open', icon: 'circle' },
  { value: 'done', label: 'Done', icon: 'check-circle' },
] as const;

function TodoCard({ todo, onPress }: { todo: TodoDto; onPress: () => void }) {
  const meta = [
    todo.assignees.length > 0 ? todo.assignees.map((a) => a.name).join(', ') : 'Unassigned',
    todo.completed
      ? `Done ${formatDate(todo.completed.at)}`
      : todo.dueOn
        ? `Due ${formatDay(todo.dueOn)}`
        : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <PressableScale onPress={onPress} accessibilityLabel="Open to-do">
      <View style={styles.todoCard}>
        <View style={styles.tagRow}>
          <Text variant="caption" color={tone.violet.fg} style={{ fontFamily: font.semibold }}>
            TO-DO
          </Text>
          {todo.completed ? (
            <Badge label="Done" t="success" />
          ) : todo.isOverdue ? (
            <Badge label="Overdue" t="danger" />
          ) : (
            <Badge label="Open" t="violet" />
          )}
        </View>
        <Text color={colors.inkDeep} numberOfLines={2}>
          {todo.title}
        </Text>
        <View style={styles.tagRow}>
          <Text variant="caption" color={colors.inkMuted} style={{ flex: 1 }}>
            {meta}
          </Text>
          {todo.commentCount > 0 ? (
            <View style={styles.comments}>
              <Feather name="message-circle" size={12} color={colors.inkMuted} />
              <Text variant="caption" color={colors.inkMuted}>
                {todo.commentCount}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}

export function TodosSegment({ project }: { project: ProjectDto }) {
  const router = useRouter();
  const { user } = useSession();
  const [status, setStatus] = useState<'open' | 'done'>('open');
  const q = useProjectTodos(project.id, status);
  return (
    <View style={styles.root}>
      <FlatList
        data={q.data ?? []}
        keyExtractor={(t) => t.id}
        contentContainerStyle={pad}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching}
            onRefresh={() => void q.refetch()}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          q.isPending ? (
            <Loading />
          ) : q.isError ? (
            <Failed onRetry={() => void q.refetch()} />
          ) : (
            <EmptyState
              icon="check-square"
              message={status === 'open' ? 'No open to-dos' : 'Nothing done yet'}
            />
          )
        }
        renderItem={({ item }) => {
          const author = item.createdBy?.name ?? 'Someone';
          return (
            <View style={styles.item}>
              <TimelineEntryRow authorName={author} accentAvatar={item.createdBy?.id === user?.id}>
                <TimelineEntryHeader
                  text={`${author} added a to-do`}
                  meta={formatDate(item.createdAt)}
                />
                <TodoCard
                  todo={item}
                  onPress={() =>
                    router.push({ pathname: '/todos/[id]', params: { id: item.id } })
                  }
                />
              </TimelineEntryRow>
            </View>
          );
        }}
      />
      <BottomBar>
        <SlidingSwitch options={TODO_FILTERS} value={status} onChange={setStatus} />
      </BottomBar>
    </View>
  );
}

/* ── Complaints ─────────────────────────────────────────────────────────────── */

export function ComplaintsSegment({ project, active }: { project: ProjectDto; active: boolean }) {
  const router = useRouter();
  const { user } = useSession();
  const q = useProjectComplaints(project.id, active);
  const closed = project.stage === 'CLOSED';
  // Newest first, so each day's complaints sit together under one separator.
  const items = useMemo(
    () => [...(q.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [q.data],
  );
  return (
    <View style={styles.root}>
      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        contentContainerStyle={pad}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching}
            onRefresh={() => void q.refetch()}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          q.isPending ? (
            <Loading />
          ) : q.isError ? (
            <Failed onRetry={() => void q.refetch()} />
          ) : (
            <EmptyState icon="life-buoy" message="No complaints on this project" />
          )
        }
        renderItem={({ item, index }) => {
          const previous = items[index - 1];
          const newDay =
            !previous || businessDate(previous.createdAt) !== businessDate(item.createdAt);
          const author = item.raisedBy?.name ?? item.customer.name;
          return (
            <View>
              {newDay ? <DaySeparator label={dayLabel(item.createdAt)} /> : null}
              <View style={styles.item}>
                <TimelineEntryRow authorName={author} accentAvatar={item.raisedBy?.id === user?.id}>
                  <ComplaintCard
                    complaint={item}
                    mine={item.raisedBy?.id === user?.id}
                    onPress={() =>
                      router.push({ pathname: '/complaints/[id]', params: { id: item.id } })
                    }
                  />
                </TimelineEntryRow>
              </View>
            </View>
          );
        }}
      />
      <BottomBar>
        {closed ? (
          <ClosedNotice text="This project is closed. It takes no new complaints." />
        ) : (
          <Button
            title="Raise complaint"
            onPress={() =>
              router.push({ pathname: '/complaints/new', params: { projectId: project.id } })
            }
            fullWidth
          />
        )}
      </BottomBar>
    </View>
  );
}

/* ── Docs ───────────────────────────────────────────────────────────────────── */

type DocBatch = {
  key: string;
  at: string;
  authorId: string | null;
  authorName: string;
  files: DocFileDto[];
};

/** Newest first; one person's files from the same day share an entry, as in the chat. */
function batchFiles(files: DocFileDto[]): DocBatch[] {
  const out: DocBatch[] = [];
  for (const f of [...files].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const last = out[out.length - 1];
    const authorId = f.uploadedBy?.id ?? null;
    if (last && last.authorId === authorId && businessDate(last.at) === businessDate(f.createdAt)) {
      last.files.push(f);
    } else {
      out.push({
        key: f.id,
        at: f.createdAt,
        authorId,
        authorName: f.uploadedBy?.name ?? 'Someone',
        files: [f],
      });
    }
  }
  return out;
}

export function DocsSegment({
  project,
  targetFileId,
  onOpenPhotos,
}: {
  project: ProjectDto;
  /** `?file=` deep link: open this file once the list is loaded. */
  targetFileId?: string;
  onOpenPhotos: (photos: ViewerPhoto[], index: number) => void;
}) {
  const { user } = useSession();
  const q = useProjectFiles(project.id);
  const batches = useMemo(() => batchFiles(q.data ?? []), [q.data]);
  const [highlight, setHighlight] = useState<string | null>(null);
  const handled = useRef<string | null>(null);

  const open = (f: DocFileDto) => {
    if (f.kind === 'IMAGE') {
      onOpenPhotos(
        [{ publicId: f.id, url: f.previewUrl ?? f.url, thumbUrl: f.thumbUrl ?? f.url }],
        0,
      );
    } else {
      void Linking.openURL(f.downloadUrl).catch(() => undefined);
    }
  };

  useEffect(() => {
    if (!targetFileId || handled.current === targetFileId || !q.data) return;
    handled.current = targetFileId;
    const f = q.data.find((x) => x.id === targetFileId);
    if (!f) return;
    setTimeout(() => setHighlight(f.id), 0);
    setTimeout(() => setHighlight(null), 2500);
    if (f.kind === 'IMAGE') {
      onOpenPhotos(
        [{ publicId: f.id, url: f.previewUrl ?? f.url, thumbUrl: f.thumbUrl ?? f.url }],
        0,
      );
    } else {
      void Linking.openURL(f.downloadUrl).catch(() => undefined);
    }
  }, [targetFileId, q.data, onOpenPhotos]);

  return (
    <View style={styles.root}>
      <FlatList
        data={batches}
        keyExtractor={(b) => b.key}
        contentContainerStyle={pad}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching}
            onRefresh={() => void q.refetch()}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          q.isPending ? (
            <Loading />
          ) : q.isError ? (
            <Failed onRetry={() => void q.refetch()} />
          ) : (
            <EmptyState icon="folder" message="No documents yet" />
          )
        }
        renderItem={({ item, index }) => {
          const previous = batches[index - 1];
          const newDay = !previous || businessDate(previous.at) !== businessDate(item.at);
          const heading =
            item.files.length === 1
              ? `${item.authorName} added a file`
              : `${item.authorName} added ${item.files.length} files`;
          return (
            <View>
              {newDay ? <DaySeparator label={dayLabel(item.at)} /> : null}
              <View style={styles.item}>
                <TimelineEntryRow
                  authorName={item.authorName}
                  accentAvatar={item.authorId === user?.id}
                >
                  <TimelineEntryHeader text={heading} meta={formatTime(item.at)} />
                  <TimelineFileRows
                    files={item.files.map((f) => ({
                      activityId: f.id,
                      fileId: f.id,
                      name: f.name,
                      meta: [
                        f.format?.toUpperCase(),
                        f.bytes != null ? formatBytes(f.bytes) : null,
                      ]
                        .filter(Boolean)
                        .join(' · '),
                      thumbUrl: f.thumbUrl,
                      previewUrl: f.kind === 'IMAGE' ? (f.previewUrl ?? f.url) : null,
                      audience: f.visibility,
                      highlighted: highlight === f.id,
                    }))}
                    onOpenFile={(id) => {
                      const f = item.files.find((x) => x.id === id);
                      if (f) open(f);
                    }}
                  />
                </TimelineEntryRow>
              </View>
            </View>
          );
        }}
      />
      <BottomBar>
        {project.stage === 'CLOSED' ? (
          <ClosedNotice text="This project is closed. It takes no new documents." />
        ) : (
          <DocUploadBar projectId={project.id} />
        )}
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageSoft },
  item: { marginVertical: space[2] },
  todoCard: {
    backgroundColor: tone.violet.bg,
    borderRadius: radius.xl,
    padding: space[3],
    gap: space[2],
  },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: space[2], flexWrap: 'wrap' },
  comments: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
