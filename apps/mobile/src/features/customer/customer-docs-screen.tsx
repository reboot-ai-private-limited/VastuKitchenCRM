import { useEffect, useRef } from 'react';
import type React from 'react';
import { FlatList, Linking, RefreshControl, Share, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import type { DocFileDto } from '@vastu/contracts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, radius, space, tone } from '@/constants/theme';
import { NetworkError } from '@/lib/api/client';
import { listProjectFiles } from '@/lib/api/endpoints/docs';
import { formatBytes, formatDate } from '@/lib/format';
import { DocUploadBar } from '@/features/projects/doc-upload-bar';
import { CustomerHeader, useActiveCustomerProject } from './customer-shell-shared';

function SharedFileCard({ file, index, highlighted }: { file: DocFileDto; index: number; highlighted?: boolean }) {
  const thumb = file.thumbUrl ?? file.previewUrl;

  return (
    <Reveal index={index}>
      <PressableScale onPress={() => void Linking.openURL(file.url)}>
        <Card style={[styles.fileCard, highlighted && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={styles.thumb} contentFit="cover" />
          ) : (
            <View style={[styles.extBox, { backgroundColor: tone.info.bg }]}>
              <Feather name="file-text" size={20} color={tone.info.fg} />
              <Text variant="caption" color={tone.info.fg}>
                {(file.format ?? 'DOC').slice(0, 4).toUpperCase()}
              </Text>
            </View>
          )}

          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label" numberOfLines={1} ellipsizeMode="middle">
              {file.name}
            </Text>
            <Text variant="caption" muted style={{ fontVariant: ['tabular-nums'] }}>
              {formatBytes(file.bytes)} · {formatDate(file.createdAt)}
            </Text>
          </View>

          <IconButton
            icon="share-2"
            label={`Share ${file.name}`}
            onPress={() =>
              void Share.share({
                message: `${file.name}: ${file.downloadUrl}`,
                url: file.downloadUrl,
              })
            }
          />
          <IconButton
            icon="external-link"
            label={`Open ${file.name}`}
            onPress={() => void Linking.openURL(file.url)}
          />
        </Card>
      </PressableScale>
    </Reveal>
  );
}

export function CustomerDocsScreen() {
  const { projectId: paramProjectId, file: fileParam } = useLocalSearchParams<{ projectId?: string; file?: string }>();
  const insets = useSafeAreaInsets();
  const { projects, project, setProjectId, isPending: projectsPending } =
    useActiveCustomerProject(paramProjectId);

  const filesQ = useQuery({
    queryKey: ['customer', 'files', project?.id],
    queryFn: ({ signal }) => listProjectFiles(project!.id, { shared: true }, signal),
    enabled: !!project?.id,
  });

  const listRef = useRef<FlatList<DocFileDto>>(null);
  const files = filesQ.data;
  useEffect(() => {
    const i = fileParam && files ? files.findIndex((f) => f.id === fileParam) : -1;
    if (i >= 0) listRef.current?.scrollToIndex({ index: i, animated: true, viewPosition: 0.2 });
  }, [fileParam, files]);

  let empty: React.ReactElement | undefined;
  if (projectsPending || filesQ.isPending) {
    empty = (
      <View style={{ gap: space[3] }}>
        {[0, 1, 2].map((i) => (
          <Card key={i} style={{ gap: space[2] }}>
            <Skeleton height={20} width="65%" />
            <Skeleton width="40%" />
          </Card>
        ))}
      </View>
    );
  } else if (filesQ.isError) {
    empty = (
      <View style={{ alignItems: 'center', gap: space[3], paddingVertical: space[8] }}>
        <Text muted style={{ textAlign: 'center' }}>
          {filesQ.error instanceof NetworkError
            ? 'Connection lost. Check your internet and try again.'
            : filesQ.error.message}
        </Text>
        <Button title="Retry" variant="outline" onPress={() => void filesQ.refetch()} />
      </View>
    );
  } else {
    empty = (
      <EmptyState
        icon="folder"
        message="Drawings, renders, and handover documents shared with you will appear here."
      />
    );
  }

  return (
    <FlatList
      ref={listRef}
      style={styles.root}
      onScrollToIndexFailed={() => undefined}
      contentContainerStyle={{
        paddingTop: insets.top + space[4],
        paddingHorizontal: space[4],
        paddingBottom: space[8],
        gap: space[3],
      }}
      data={filesQ.data ?? []}
      keyExtractor={(f) => f.id}
      renderItem={({ item, index }) => (
        <SharedFileCard file={item} index={index} highlighted={item.id === fileParam} />
      )}
      ListHeaderComponent={
        <View style={{ gap: space[3], paddingBottom: space[2] }}>
          <CustomerHeader
            project={project}
            projects={projects}
            onSelectProject={setProjectId}
          />
          {project && project.stage !== 'CLOSED' ? <DocUploadBar projectId={project.id} isCustomer /> : null}
          <Text variant="caption" muted style={{ letterSpacing: 0.6 }}>
            SHARED DOCUMENTS ({(filesQ.data ?? []).length})
          </Text>
        </View>
      }
      ListEmptyComponent={empty}
      refreshControl={
        <RefreshControl
          refreshing={filesQ.isRefetching}
          onRefresh={() => void filesQ.refetch()}
          tintColor={colors.primary}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
  },
  extBox: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
});
