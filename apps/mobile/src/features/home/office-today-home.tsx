import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, radius, shadow, space } from '@/constants/theme';
import { CheckInCard } from '@/features/attendance/check-in-card';
import { ComplaintRow } from '@/features/complaints/complaints-screen';
import { CompactTodoRow } from '@/features/todos/todos-screen';
import { useMyTodos } from '@/features/todos/use-todos';
import { listComplaints } from '@/lib/api/endpoints/complaints';
import { listLeads } from '@/lib/api/endpoints/leads';
import { useSession } from '@/lib/auth/session';
import { formatPhone, formatWeekdayDate, timeAgo } from '@/lib/format';

/**
 * Office Today (01-personas-and-navigation.md §2.6):
 * - Walk-ins / New leads are view/add ONLY (no call or visit buttons).
 * - CheckInCard automatically renders only when `attendanceType === 'GPS'` (biometric staff see none).
 */
export function OfficeTodayHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useSession();

  const newLeadsQ = useQuery({
    queryKey: ['leads', 'office-new'],
    queryFn: ({ signal }) => listLeads({ page: 1, pageSize: 12, status: 'NEW' }, signal),
  });

  const openComplaintsQ = useQuery({
    queryKey: ['complaints', 'office-open'],
    queryFn: ({ signal }) => listComplaints({ page: 1, pageSize: 10, status: 'OPEN' }, undefined, signal),
  });

  const todosQ = useMyTodos('open');

  const refreshing = newLeadsQ.isRefetching || openComplaintsQ.isRefetching || todosQ.isRefetching;
  const refreshAll = () => {
    void newLeadsQ.refetch();
    void openComplaintsQ.refetch();
    void todosQ.refetch();
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + space[4],
          paddingHorizontal: space[4],
          paddingBottom: insets.bottom + space[16],
          gap: space[5],
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={colors.primary} />
        }
      >
        <View style={styles.header}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="title">Today</Text>
            <Text variant="caption" muted>
              {formatWeekdayDate()}
            </Text>
          </View>
          {user ? (
            <Avatar name={user.name} size={36} accent onPress={() => router.push('/profile' as Href)} />
          ) : null}
        </View>

        <CheckInCard />

        {/* WALK-INS / NEW LEADS — view/add only, NO call buttons */}
        <Reveal>
          <View style={{ gap: space[2] }}>
            <View style={styles.sectionHeader}>
              <Text variant="caption" muted style={styles.eyebrow}>
                WALK-INS & NEW LEADS ({newLeadsQ.data?.total ?? 0})
              </Text>
              <PressableScale onPress={() => router.push('/leads' as Href)}>
                <Text variant="caption" color={colors.primary}>
                  All leads
                </Text>
              </PressableScale>
            </View>
            {newLeadsQ.isPending ? (
              <Skeleton height={84} />
            ) : (newLeadsQ.data?.items ?? []).length === 0 ? (
              <Card>
                <Text muted>No new walk-in leads today. Tap + to record a visitor.</Text>
              </Card>
            ) : (
              <View style={{ gap: space[2] }}>
                {(newLeadsQ.data?.items ?? []).slice(0, 6).map((lead) => (
                  <PressableScale
                    key={lead.id}
                    onPress={() =>
                      router.push({ pathname: '/leads/[id]', params: { id: lead.id } } as Href)
                    }
                  >
                    <Card style={styles.leadRow}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text variant="label" numberOfLines={1}>
                          {lead.name}
                        </Text>
                        <Text variant="caption" muted style={{ fontVariant: ['tabular-nums'] }}>
                          {formatPhone(lead.phone)}
                          {lead.city ? `  ·  ${lead.city}` : ''}
                        </Text>
                        <Text variant="caption" muted>
                          {lead.assignedTo ? `Owner: ${lead.assignedTo.name}` : 'Unassigned'} ·{' '}
                          {timeAgo(lead.createdAt)}
                        </Text>
                      </View>
                      <Badge label={lead.source === 'WALK_IN' ? 'Walk-in' : 'New'} t="info" />
                      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                    </Card>
                  </PressableScale>
                ))}
              </View>
            )}
          </View>
        </Reveal>

        {/* COMPLAINTS NEEDING ATTENTION */}
        <Reveal index={1}>
          <View style={{ gap: space[2] }}>
            <View style={styles.sectionHeader}>
              <Text variant="caption" muted style={styles.eyebrow}>
                COMPLAINTS NEEDING ATTENTION ({openComplaintsQ.data?.total ?? 0})
              </Text>
              <PressableScale onPress={() => router.push('/complaints' as Href)}>
                <Text variant="caption" color={colors.primary}>
                  Open all
                </Text>
              </PressableScale>
            </View>
            {openComplaintsQ.isPending ? (
              <Skeleton height={84} />
            ) : (openComplaintsQ.data?.items ?? []).length === 0 ? (
              <Card>
                <Text muted>No unassigned complaints waiting right now.</Text>
              </Card>
            ) : (
              <View style={{ gap: space[2] }}>
                {(openComplaintsQ.data?.items ?? []).slice(0, 5).map((c) => (
                  <ComplaintRow key={c.id} c={c} />
                ))}
              </View>
            )}
          </View>
        </Reveal>

        {/* MY TO-DOS */}
        <Reveal index={2}>
          <View style={{ gap: space[2] }}>
            <View style={styles.sectionHeader}>
              <Text variant="caption" muted style={styles.eyebrow}>
                MY TO-DOS ({(todosQ.data ?? []).length})
              </Text>
              <PressableScale onPress={() => router.push('/todos' as Href)}>
                <Text variant="caption" color={colors.primary}>
                  View all
                </Text>
              </PressableScale>
            </View>
            {todosQ.isPending ? (
              <Skeleton height={84} />
            ) : (todosQ.data ?? []).length === 0 ? (
              <Card>
                <Text muted>No open office to-dos right now.</Text>
              </Card>
            ) : (
              <View style={{ gap: space[2] }}>
                {(todosQ.data ?? []).slice(0, 5).map((t) => (
                  <CompactTodoRow key={t.id} todo={t} />
                ))}
              </View>
            )}
          </View>
        </Reveal>
      </ScrollView>

      <PressableScale
        onPress={() => router.push('/leads/new' as Href)}
        accessibilityRole="button"
        accessibilityLabel="Add walk-in lead"
        style={[styles.fab, { bottom: space[4] }]}
      >
        <Feather name="plus" size={24} color={colors.primaryForeground} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: { letterSpacing: 0.6 },
  leadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  fab: {
    position: 'absolute',
    right: space[4],
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sheet,
  },
});
