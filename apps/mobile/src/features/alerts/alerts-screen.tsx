import type React from 'react';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NotificationDto, RoleName } from '@vastu/contracts';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, font, hit, radius, space } from '@/constants/theme';
import { NetworkError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { timeAgo } from '@/lib/format';
import { routeFor } from './route-for';
import { useMarkAllRead, useMarkRead, useNotifications } from './use-notifications';

function AlertRow({ n, role }: { n: NotificationDto; role?: RoleName }) {
  const router = useRouter();
  const markRead = useMarkRead();
  const unread = n.readAt === null;
  const [reason, setReason] = useState<string | null>(null);

  return (
    <PressableScale
      onPress={() => {
        if (unread) markRead.mutate(n.id);
        const href = routeFor(n.ref, role);
        if (href) router.push(href);
        else setReason(n.ref ? 'Your role cannot open this item.' : 'This alert has nothing to open.');
      }}
      scaleTo={0.99}
      accessibilityRole="button"
      style={[styles.flatRow, unread && styles.unreadRow]}
    >
      <View style={[styles.dot, unread && styles.dotUnread]} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.titleRow}>
          <Text
            color={colors.inkDeep}
            style={[styles.title, unread && { fontFamily: font.semibold }]}
            numberOfLines={2}
          >
            {n.title}
          </Text>
          <Text variant="caption" color={colors.inkMuted} style={{ flexShrink: 0 }}>
            {timeAgo(n.createdAt)}
          </Text>
        </View>
        <Text color={colors.inkMuted} style={styles.bodyText}>
          {n.body}
        </Text>
        {reason ? (
          <Text variant="caption" color={colors.destructive} accessibilityLiveRegion="polite">
            {reason}
          </Text>
        ) : null}
      </View>
    </PressableScale>
  );
}

export function AlertsScreen({ standalone = false }: { standalone?: boolean }) {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const q = useNotifications();
  const markAll = useMarkAllRead();
  const hasUnread = q.data?.some((n) => n.readAt === null) ?? false;

  let body: React.ReactElement | undefined;
  if (q.isPending) {
    body = (
      <View>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.skeletonRow, i > 0 && styles.divider]}>
            <Skeleton height={16} width="50%" />
            <Skeleton height={14} width="82%" />
          </View>
        ))}
      </View>
    );
  } else if (q.isError) {
    body = (
      <View style={styles.errorWrap}>
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
    <View style={styles.root}>
      {standalone ? (
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Notifications',
            headerShadowVisible: false,
            headerTintColor: colors.primary,
            headerRight: hasUnread
              ? () => (
                  <Button
                    title="Mark all read"
                    variant="ghost"
                    size="sm"
                    loading={markAll.isPending}
                    onPress={() => markAll.mutate()}
                  />
                )
              : undefined,
          }}
        />
      ) : (
        <View style={[styles.stickyHeader, { paddingTop: insets.top + space[4] }]}>
          <Text variant="title" color={colors.inkDeep}>
            Alerts
          </Text>
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
      )}

      <FlatList
        data={q.data ?? []}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => <AlertRow n={item} role={user?.role} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={body}
        ListFooterComponent={
          q.isFetchingNextPage ? (
            <View style={{ padding: space[4] }}>
              <Skeleton height={56} />
            </View>
          ) : undefined
        }
        contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + space[8] }}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.card },
  stickyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    paddingHorizontal: space[4],
    paddingBottom: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  flatRow: {
    flexDirection: 'row',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    backgroundColor: colors.card,
    minHeight: hit,
  },
  unreadRow: {
    backgroundColor: colors.primarySoft,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
    marginTop: 7,
    backgroundColor: 'transparent',
  },
  dotUnread: {
    backgroundColor: colors.primary,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[2],
  },
  title: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: font.medium,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  skeletonRow: {
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: space[2],
  },
  errorWrap: {
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[8],
    paddingHorizontal: space[4],
  },
});
