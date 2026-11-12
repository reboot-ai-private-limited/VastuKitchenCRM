import type React from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, space } from '@/constants/theme';
import { ComplaintRow } from '@/features/complaints/complaints-screen';
import { useComplaintsList } from '@/features/complaints/use-complaints';
import { NetworkError } from '@/lib/api/client';
import { CustomerHeader, useActiveCustomerProject } from './customer-shell-shared';

export function CustomerComplaintsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { projects, project, setProjectId, isPending: projectsPending } = useActiveCustomerProject();

  const q = useComplaintsList(undefined, project?.id);

  let empty: React.ReactElement | undefined;
  if (projectsPending || q.isPending) {
    empty = (
      <View style={{ gap: space[3] }}>
        {[0, 1].map((i) => (
          <Card key={i} style={{ gap: space[2] }}>
            <Skeleton height={18} width="55%" />
            <Skeleton width="80%" />
          </Card>
        ))}
      </View>
    );
  } else if (q.isError) {
    empty = (
      <View style={{ alignItems: 'center', gap: space[3], paddingVertical: space[8] }}>
        <Text muted style={{ textAlign: 'center' }}>
          {q.error instanceof NetworkError
            ? 'Connection lost. Check your internet and try again.'
            : q.error.message}
        </Text>
        <Button title="Retry" variant="outline" onPress={() => void q.refetch()} />
      </View>
    );
  } else {
    empty = (
      <EmptyState
        icon="shield"
        message="No service complaints raised on this project."
      />
    );
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
      data={project ? (q.data ?? []) : []}
      keyExtractor={(c) => c.id}
      renderItem={({ item }) => <ComplaintRow c={item} />}
      ListHeaderComponent={
        <View style={{ gap: space[4], paddingBottom: space[1] }}>
          <CustomerHeader
            project={project}
            projects={projects}
            onSelectProject={setProjectId}
          />
          {project && project.stage !== 'CLOSED' ? (
            <Button
              title="Raise a complaint"
              size="lg"
              onPress={() =>
                router.push({
                  pathname: '/complaints/new',
                  params: { projectId: project.id },
                } as Href)
              }
              fullWidth
            />
          ) : null}
          <Text variant="caption" muted style={{ letterSpacing: 0.6 }}>
            SERVICE TICKETS
          </Text>
        </View>
      }
      ListEmptyComponent={empty}
      ListFooterComponent={q.isFetchingNextPage ? <Skeleton height={80} /> : undefined}
      onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
      onEndReachedThreshold={0.5}
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
});
