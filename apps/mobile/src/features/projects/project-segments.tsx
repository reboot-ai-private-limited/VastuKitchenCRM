import { useEffect, useRef, useState } from 'react';
import { FlatList, Linking, RefreshControl, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import type { DocFileDto, ProjectDto } from '@vastu/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, radius, space, tone } from '@/constants/theme';
import { formatBytes, formatDate } from '@/lib/format';
import type { ViewerPhoto } from './photo-viewer';
import { COMPLAINT_STATUS_LABEL, COMPLAINT_STATUS_TONE } from './project-meta';
import { useProjectComplaints, useProjectFiles, useProjectTodos } from './use-projects';

const pad = { padding: space[4], gap: space[3], paddingBottom: space[8] } as const;

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
        <Skeleton key={i} height={64} />
      ))}
    </View>
  );
}

/* ── To-dos ─────────────────────────────────────────────────────────────────── */

export function TodosSegment({ project }: { project: ProjectDto }) {
  const router = useRouter();
  const [status, setStatus] = useState<'open' | 'done'>('open');
  const q = useProjectTodos(project.id, status);
  return (
    <FlatList
      data={q.data ?? []}
      keyExtractor={(t) => t.id}
      contentContainerStyle={pad}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.primary} />}
      ListHeaderComponent={
        <View style={{ flexDirection: 'row', gap: space[1] }}>
          <Chip label="Open" active={status === 'open'} onPress={() => setStatus('open')} />
          <Chip label="Done" active={status === 'done'} onPress={() => setStatus('done')} />
        </View>
      }
      ListEmptyComponent={
        q.isPending ? <Loading /> : q.isError ? <Failed onRetry={() => void q.refetch()} /> : (
          <EmptyState icon="check-square" message={status === 'open' ? 'No open to-dos' : 'Nothing done yet'} />
        )
      }
      renderItem={({ item }) => (
        <PressableScale onPress={() => router.push({ pathname: '/todos/[id]', params: { id: item.id } })}>
          <Card style={{ gap: space[1] }}>
            <Text variant="label">{item.title}</Text>
            <View style={{ flexDirection: 'row', gap: space[2], flexWrap: 'wrap', alignItems: 'center' }}>
              {item.isOverdue ? <Badge label="Overdue" t="danger" /> : null}
              {item.dueOn ? (
                <Text variant="caption" muted>
                  Due {item.dueOn}
                </Text>
              ) : null}
              {item.assignees.length > 0 ? (
                <Text variant="caption" muted>
                  {item.assignees.map((a) => a.name).join(', ')}
                </Text>
              ) : null}
            </View>
          </Card>
        </PressableScale>
      )}
    />
  );
}

/* ── Complaints ─────────────────────────────────────────────────────────────── */

export function ComplaintsSegment({ project, active }: { project: ProjectDto; active: boolean }) {
  const router = useRouter();
  const q = useProjectComplaints(project.id, active);
  const closed = project.stage === 'CLOSED';
  return (
    <FlatList
      data={q.data ?? []}
      keyExtractor={(c) => c.id}
      contentContainerStyle={pad}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.primary} />}
      ListHeaderComponent={
        !closed ? (
          <Button
            title="Raise complaint"
            variant="outline"
            onPress={() => router.push({ pathname: '/complaints/new', params: { projectId: project.id } })}
            fullWidth
          />
        ) : undefined
      }
      ListEmptyComponent={
        q.isPending ? <Loading /> : q.isError ? <Failed onRetry={() => void q.refetch()} /> : (
          <EmptyState icon="shield" message="No complaints on this project" />
        )
      }
      renderItem={({ item }) => (
        <PressableScale onPress={() => router.push({ pathname: '/complaints/[id]', params: { id: item.id } })}>
          <Card style={{ gap: space[2] }}>
            <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'center' }}>
              <Badge label={COMPLAINT_STATUS_LABEL[item.status]} t={COMPLAINT_STATUS_TONE[item.status]} />
              {item.reopenCount > 0 ? <Badge label={`Reopened x${item.reopenCount}`} t="warning" /> : null}
            </View>
            <Text numberOfLines={2}>{item.description}</Text>
            <Text variant="caption" muted>
              {item.assignedTo ? `Assigned to ${item.assignedTo.name} · ` : 'Not assigned · '}
              {formatDate(item.createdAt)}
            </Text>
          </Card>
        </PressableScale>
      )}
    />
  );
}

/* ── Docs ───────────────────────────────────────────────────────────────────── */

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
  const q = useProjectFiles(project.id);
  const [highlight, setHighlight] = useState<string | null>(null);
  const handled = useRef<string | null>(null);

  const open = (f: DocFileDto) => {
    if (f.kind === 'IMAGE') {
      onOpenPhotos([{ publicId: f.id, url: f.previewUrl ?? f.url, thumbUrl: f.thumbUrl ?? f.url }], 0);
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
      onOpenPhotos([{ publicId: f.id, url: f.previewUrl ?? f.url, thumbUrl: f.thumbUrl ?? f.url }], 0);
    } else {
      void Linking.openURL(f.downloadUrl).catch(() => undefined);
    }
  }, [targetFileId, q.data, onOpenPhotos]);

  return (
    <FlatList
      data={q.data ?? []}
      keyExtractor={(f) => f.id}
      contentContainerStyle={pad}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.primary} />}
      ListEmptyComponent={
        q.isPending ? <Loading /> : q.isError ? (
          <Failed onRetry={() => void q.refetch()} />
        ) : (
          <EmptyState icon="folder" message="No documents yet" />
        )
      }
      renderItem={({ item }) => (
        <PressableScale onPress={() => open(item)}>
          <Card style={[{ flexDirection: 'row', gap: space[3], alignItems: 'center' }, highlight === item.id && styles.highlight]}>
            {item.thumbUrl ? (
              <Image source={{ uri: item.thumbUrl }} style={styles.thumb} contentFit="cover" />
            ) : (
              <View style={[styles.thumb, { alignItems: 'center', justifyContent: 'center' }]}>
                <Feather name="file-text" size={20} color={colors.mutedForeground} />
              </View>
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label" numberOfLines={1}>
                {item.name}
              </Text>
              <Text variant="caption" muted numberOfLines={1}>
                {[item.format?.toUpperCase(), item.bytes != null ? formatBytes(item.bytes) : null, formatDate(item.createdAt)]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            {item.visibility === 'CLIENT' ? <Badge label="Shared" t="success" /> : <Badge label="Team" t="orange" />}
          </Card>
        </PressableScale>
      )}
    />
  );
}


const styles = StyleSheet.create({
  thumb: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.muted },
  highlight: { borderColor: tone.success.fg, borderWidth: 2 },
});
