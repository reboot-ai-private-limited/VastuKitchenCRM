import type React from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NotificationDto, RoleName } from '@vastu/contracts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, space } from '@/constants/theme';
import { NetworkError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { timeAgo } from '@/lib/format';
import { routeFor } from './route-for';
import { useMarkAllRead, useMarkRead, useNotifications } from './use-notifications';

function AlertRow({ n, role }: { n: NotificationDto; role?: RoleName }) {
  const router = useRouter();
  const markRead = useMarkRead();
  const unread = n.readAt === null;
  return (
    <Reveal>
      <PressableScale
        onPress={() => {
          if (unread) markRead.mutate(n.id);
          const href = routeFor(n.ref, role);
          if (href) router.push(href);
        }}
      >
        <Card style={{ flexDirection: 'row', gap: space[3], backgroundColor: unread ? colors.primarySoft : colors.card }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              marginTop: 7,
              backgroundColor: unread ? colors.primary : 'transparent',
            }}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label">{n.title}</Text>
            <Text muted>{n.body}</Text>
            <Text variant="caption" muted>
              {timeAgo(n.createdAt)}
            </Text>
          </View>
        </Card>
      </PressableScale>
    </Reveal>
  );
}

export function AlertsScreen({ standalone = false }: { standalone?: boolean }) {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const q = useNotifications();
  const markAll = useMarkAllRead();
  const hasUnread = q.data?.some((n) => n.readAt === null) ?? false;

  const header = (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: space[2] }}
    >
      {!standalone ? <Text variant="title">Alerts</Text> : <View />}
      {hasUnread ? (
        <Button
          title="Mark all read"
          variant="ghost"
          size="sm"
          loading={markAll.isPending}
          onPress={() => markAll.mutate()}
        />
      ) : null}
    </View>
  );

  let body: React.ReactElement | undefined;
  if (q.isPending) {
    body = (
      <View style={{ gap: space[3] }}>
        {[0, 1, 2].map((i) => (
          <Card key={i} style={{ gap: space[2] }}>
            <Skeleton height={16} width="50%" />
            <Skeleton width="80%" />
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
    body = <EmptyState icon="bell" message="You are all caught up." />;
  }

  return (
    <>
      {standalone ? (
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Notifications',
            headerShadowVisible: false,
            headerTintColor: colors.primary,
          }}
        />
      ) : null}
      <FlatList
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{
          paddingTop: standalone ? space[2] : insets.top + space[4],
          paddingHorizontal: space[4],
          paddingBottom: insets.bottom + space[8],
          gap: space[3],
        }}
        data={q.data ?? []}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => <AlertRow n={item} role={user?.role} />}
        ListHeaderComponent={header}
        ListEmptyComponent={body}
        ListFooterComponent={q.isFetchingNextPage ? <Skeleton height={70} /> : undefined}
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
    </>
  );
}
