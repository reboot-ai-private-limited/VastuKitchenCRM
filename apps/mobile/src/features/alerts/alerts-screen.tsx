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
import { SlidingSwitch } from '@/features/projects/sliding-switch';
import { NetworkError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { timeAgo } from '@/lib/format';
import { routeFor } from './route-for';
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from './use-notifications';

/** Phrase older stage-age alerts in past tense so they never look like current stage age. */
function formatAlertBody(n: NotificationDto): string {
  const ageMs = Date.now() - Date.parse(n.createdAt);
  if (!Number.isNaN(ageMs) && ageMs >= 86_400_000) {
    const match = n.body.match(/^(.*?) has been in (.+?) for ([^.]+)\.?$/i);
    if (match) {
      return `${match[1]} had been in ${match[2]} for ${match[3]} when this alert was sent.`;
    }
  }
  return n.body;
}

function AlertRow({ n, role }: { n: NotificationDto; role?: RoleName }) {
  const router = useRouter();
  const markRead = useMarkRead();
  const unread = n.readAt === null;
  const [reason, setReason] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const body = formatAlertBody(n);

  const retryMarkRead = () => {
    setReadError(null);
    markRead.mutate(n.id, {
      onError: () => setReadError('Could not mark as read.'),
    });
  };

  return (
    <PressableScale
      onPress={() => {
        const href = routeFor(n.ref, role);
        if (!href) {
          setReason(n.ref ? 'Your role cannot open this item.' : 'This alert has nothing to open.');
          return;
        }
        setReason(null);
        setReadError(null);
        if (unread) {
          markRead.mutate(n.id, {
            onError: () => setReadError('Could not mark as read.'),
          });
        }
        router.push(href);
      }}
      scaleTo={0.99}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread: ' : ''}${n.title}. ${body}`}
      style={[styles.flatRow, unread && styles.unreadRow]}
    >
      <View style={[styles.dot, unread && styles.dotUnread]} />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.titleRow}>
          <Text
            color={colors.inkDeep}
            style={[styles.title, unread && styles.titleUnread]}
            numberOfLines={1}
          >
            {n.title}
          </Text>
          <Text variant="caption" color={colors.inkMuted} style={styles.time}>
            {timeAgo(n.createdAt)}
          </Text>
        </View>
        <Text color={unread ? colors.inkDeep : colors.inkMuted} style={styles.bodyText} numberOfLines={2}>
          {body}
        </Text>
        {reason ? (
          <Text variant="caption" color={colors.destructive} accessibilityLiveRegion="polite">
            {reason}
          </Text>
        ) : null}
        {readError ? (
          <View style={styles.retryRow} accessibilityLiveRegion="polite">
            <Text variant="caption" color={colors.destructive}>
              {readError}
            </Text>
            <PressableScale onPress={retryMarkRead} hitSlop={8}>
              <Text variant="caption" color={colors.primaryPressed} style={{ fontFamily: font.semibold }}>
                Retry
              </Text>
            </PressableScale>
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}

export function AlertsScreen({ standalone = false }: { standalone?: boolean }) {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const [view, setView] = useState<'all' | 'read' | 'unread'>('all');
  const q = useNotifications(view);
  const unreadQ = useUnreadCount();
  const markAll = useMarkAllRead();
  const unreadCount = unreadQ.data ?? 0;
  const hasUnread = unreadCount > 0 || (q.data?.some((n) => n.readAt === null) ?? false);

  const unreadLabel = unreadCount > 0 ? `Unread (${unreadCount})` : 'Unread';
  const viewOptions = [
    { value: 'all', label: 'All' },
    { value: 'read', label: 'Read' },
    { value: 'unread', label: unreadLabel },
  ] as const;

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
    body = (
      <EmptyState
        icon="bell"
        message={
          view === 'unread'
            ? 'No unread alerts.'
            : view === 'read'
              ? 'No read alerts yet.'
              : 'You are all caught up.'
        }
      />
    );
  }

  return (
    <View style={styles.root}>
      {standalone ? <Stack.Screen options={{ headerShown: false }} /> : null}
      <View style={[styles.stickyHeader, { paddingTop: insets.top + space[4] }]}>
        <View style={styles.headerRow}>
          <Text variant="title" color={colors.inkDeep} style={styles.heading}>
            {standalone ? 'Notifications' : 'Alerts'}
          </Text>
          {hasUnread ? (
            <View style={styles.headerRight}>
              <Button
                title="Mark all read"
                variant="ghost"
                size="sm"
                loading={markAll.isPending}
                onPress={() => markAll.mutate()}
              />
            </View>
          ) : null}
        </View>
        <SlidingSwitch options={viewOptions} value={view} onChange={setView} />
      </View>

      <FlatList
        data={q.data ?? []}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => <AlertRow n={item} role={user?.role} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={body}
        ListFooterComponent={
          q.isFetchingNextPage ? (
            <View style={styles.footer}>
              <Skeleton height={56} />
            </View>
          ) : q.isFetchNextPageError ? (
            <PressableScale
              onPress={() => void q.fetchNextPage()}
              accessibilityRole="button"
              style={styles.loadMoreError}
            >
              <Text variant="caption" color={colors.inkMuted}>
                Couldn’t load more
              </Text>
              <Text variant="caption" color={colors.primaryPressed} style={{ fontFamily: font.semibold }}>
                · Retry
              </Text>
            </PressableScale>
          ) : undefined
        }
        contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + space[8] }}
        onEndReached={() =>
          q.hasNextPage && !q.isFetchingNextPage && !q.isFetchNextPageError && void q.fetchNextPage()
        }
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching && !q.isFetchingNextPage}
            onRefresh={() => {
              void q.refetch();
              void unreadQ.refetch();
            }}
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
    backgroundColor: colors.card,
    paddingHorizontal: space[4],
    paddingBottom: space[3],
    gap: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  standaloneBar: {
    backgroundColor: colors.card,
    paddingHorizontal: space[4],
    paddingTop: space[1],
    paddingBottom: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerRow: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 32,
  },
  heading: {
    textAlign: 'center',
  },
  headerRight: {
    position: 'absolute',
    right: 0,
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  title: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: font.medium,
  },
  titleUnread: {
    fontFamily: font.semibold,
  },
  time: {
    flexShrink: 0,
    fontVariant: ['tabular-nums'],
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  retryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginTop: 2,
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
  footer: {
    padding: space[4],
  },
  loadMoreError: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: hit,
    paddingHorizontal: space[4],
  },
});
