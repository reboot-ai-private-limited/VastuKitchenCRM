import type React from 'react';
import { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ProjectDto, ProjectStage } from '@vastu/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, font, radius, space } from '@/constants/theme';
import { NetworkError } from '@/lib/api/client';
import { formatINR } from '@/lib/format';
import { DESIGN_LABEL, DESIGN_TONE, STAGE_LABEL, STAGE_ORDER, STAGE_TONE } from './project-meta';
import { useProjectsList } from './use-projects';

function ProjectRow({ project }: { project: ProjectDto }) {
  const router = useRouter();
  return (
    <Reveal>
      <PressableScale onPress={() => router.push({ pathname: '/projects/[id]', params: { id: project.id } })}>
        <Card style={{ gap: space[2] }}>
          <View style={styles.row}>
            <Text variant="section" numberOfLines={1} style={{ flex: 1 }}>
              {project.name}
            </Text>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </View>
          <Text muted numberOfLines={1}>
            {project.customer.name}
            {project.value != null ? `  ·  ${formatINR(project.value)}` : ''}
          </Text>
          <View style={styles.row}>
            <Badge label={STAGE_LABEL[project.stage]} t={STAGE_TONE[project.stage]} />
            {project.stage === 'DESIGN' ? (
              <Badge label={DESIGN_LABEL[project.designStage]} t={DESIGN_TONE[project.designStage]} />
            ) : null}
          </View>
        </Card>
      </PressableScale>
    </Reveal>
  );
}

export function ProjectsScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState<ProjectStage | undefined>();
  const q = useProjectsList(search.trim(), stage);

  const header = (
    <View style={{ gap: space[3], paddingBottom: space[2] }}>
      <Text variant="title">Projects</Text>
      <View style={styles.search}>
        <Feather name="search" size={18} color={colors.mutedForeground} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search project or customer"
          placeholderTextColor={colors.placeholder}
          returnKeyType="search"
          style={styles.searchInput}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2] }}>
        {[undefined, ...STAGE_ORDER].map((s) => {
          const active = s === stage;
          return (
            <PressableScale
              key={s ?? 'all'}
              onPress={() => setStage(s)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text variant="caption" color={active ? colors.primaryForeground : colors.mutedForeground}>
                {s ? STAGE_LABEL[s] : 'All'}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );

  let body: React.ReactElement | undefined;
  if (q.isPending) {
    body = (
      <View style={{ gap: space[3] }}>
        {[0, 1, 2].map((i) => (
          <Card key={i} style={{ gap: space[2] }}>
            <Skeleton height={18} width="60%" />
            <Skeleton width="45%" />
            <Skeleton height={20} width={100} />
          </Card>
        ))}
      </View>
    );
  } else if (q.isError) {
    body = (
      <View style={{ alignItems: 'center', gap: space[3], paddingVertical: space[8] }}>
        <Text muted style={{ textAlign: 'center' }}>
          {q.error instanceof NetworkError
            ? 'Connection lost. Check your internet and try again.'
            : q.error.message}
        </Text>
        <Button title="Retry" variant="outline" onPress={() => void q.refetch()} />
      </View>
    );
  } else if (q.data.length === 0) {
    body = <EmptyState icon="layers" message="No projects found." />;
  }

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={{
        paddingTop: insets.top + space[4],
        paddingHorizontal: space[4],
        paddingBottom: space[8],
        gap: space[3],
      }}
      data={q.data ?? []}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => <ProjectRow project={item} />}
      ListHeaderComponent={header}
      ListEmptyComponent={body}
      ListFooterComponent={q.isFetchingNextPage ? <Skeleton height={80} /> : undefined}
      onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
      onEndReachedThreshold={0.5}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={q.isRefetching && !q.isFetchingNextPage}
          onRefresh={() => void q.refetch()}
          tintColor={colors.primary}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    height: 44,
    paddingHorizontal: space[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.input,
  },
  searchInput: { flex: 1, fontFamily: font.regular, fontSize: 16, color: colors.foreground },
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.primary },
});
