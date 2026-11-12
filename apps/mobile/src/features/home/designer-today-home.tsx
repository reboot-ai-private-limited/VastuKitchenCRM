import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { BlockError } from './block-error';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, space } from '@/constants/theme';
import { CheckInCard } from '@/features/attendance/check-in-card';
import { ComplaintRow } from '@/features/complaints/complaints-screen';
import { CompactTodoRow } from '@/features/todos/todos-screen';
import { useMyTodos } from '@/features/todos/use-todos';
import { listComplaints } from '@/lib/api/endpoints/complaints';
import { listProjects } from '@/lib/api/endpoints/projects';
import { useSession } from '@/lib/auth/session';
import { formatWeekdayDate } from '@/lib/format';

export function DesignerTodayHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useSession();

  const waitingQ = useQuery({
    queryKey: ['projects', 'designer-waiting', user?.id],
    queryFn: ({ signal }) =>
      listProjects(
        { page: 1, pageSize: 12, stage: 'DESIGN', designStage: 'SHARED', designerId: user?.id },
        signal,
      ),
    enabled: !!user?.id,
  });

  const todosQ = useMyTodos('open');

  const complaintsQ = useQuery({
    queryKey: ['complaints', 'designer-mine'],
    queryFn: ({ signal }) => listComplaints({ page: 1, pageSize: 10, assignedTo: 'me' }, undefined, signal),
    select: (d) => d.items.filter((c) => c.status !== 'CLOSED'),
  });

  const todos = todosQ.data ?? [];
  const overdueCount = todos.filter((t) => t.bucket === 'OVERDUE').length;
  const todayCount = todos.filter((t) => t.bucket === 'TODAY').length;

  const refreshing = waitingQ.isRefetching || todosQ.isRefetching || complaintsQ.isRefetching;
  const refreshAll = () => {
    void waitingQ.refetch();
    void todosQ.refetch();
    void complaintsQ.refetch();
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingTop: insets.top + space[4],
        paddingHorizontal: space[4],
        paddingBottom: insets.bottom + space[8],
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

      {/* WAITING ON CUSTOMER */}
      <Reveal>
        <View style={{ gap: space[2] }}>
          <View style={styles.sectionHeader}>
            <Text variant="caption" muted style={styles.eyebrow}>
              WAITING ON CUSTOMER ({waitingQ.data?.total ?? 0})
            </Text>
            <PressableScale onPress={() => router.push('/projects' as Href)}>
              <Text variant="caption" color={colors.primary}>
                All projects
              </Text>
            </PressableScale>
          </View>
          {waitingQ.isPending ? (
            <Skeleton height={84} />
          ) : waitingQ.isError && waitingQ.data === undefined ? (
            <BlockError error={waitingQ.error} onRetry={() => void waitingQ.refetch()} />
          ) : (waitingQ.data?.items ?? []).length === 0 ? (
            <Card>
              <Text muted>No shared designs are waiting on customer approval.</Text>
            </Card>
          ) : (
            <View style={{ gap: space[2] }}>
              {(waitingQ.data?.items ?? []).map((p) => (
                <PressableScale
                  key={p.id}
                  onPress={() =>
                    router.push({ pathname: '/projects/[id]', params: { id: p.id } } as Href)
                  }
                >
                  <Card style={styles.projectRow}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="label" numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text variant="caption" muted numberOfLines={1}>
                        {p.customer.name}
                      </Text>
                    </View>
                    <Badge label="Design shared" t="warning" />
                    <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                  </Card>
                </PressableScale>
              ))}
            </View>
          )}
        </View>
      </Reveal>

      {/* MY TO-DOS */}
      <Reveal index={1}>
        <View style={{ gap: space[2] }}>
          <View style={styles.sectionHeader}>
            <Text variant="caption" muted style={styles.eyebrow}>
              MY TO-DOS · OVERDUE {overdueCount} · TODAY {todayCount}
            </Text>
            <PressableScale onPress={() => router.push('/todos' as Href)}>
              <Text variant="caption" color={colors.primary}>
                Open all
              </Text>
            </PressableScale>
          </View>
          {todosQ.isPending ? (
            <Skeleton height={90} />
          ) : todosQ.isError && todosQ.data === undefined ? (
            <BlockError error={todosQ.error} onRetry={() => void todosQ.refetch()} />
          ) : todos.length === 0 ? (
            <Card>
              <Text muted>No open to-dos assigned to you.</Text>
            </Card>
          ) : (
            <View style={{ gap: space[2] }}>
              {todos.slice(0, 6).map((t) => (
                <CompactTodoRow key={t.id} todo={t} />
              ))}
            </View>
          )}
        </View>
      </Reveal>

      {/* COMPLAINTS FOR ME */}
      <Reveal index={2}>
        <View style={{ gap: space[2] }}>
          <View style={styles.sectionHeader}>
            <Text variant="caption" muted style={styles.eyebrow}>
              COMPLAINTS FOR ME ({(complaintsQ.data ?? []).length})
            </Text>
            <PressableScale onPress={() => router.push('/complaints' as Href)}>
              <Text variant="caption" color={colors.primary}>
                View all
              </Text>
            </PressableScale>
          </View>
          {complaintsQ.isPending ? (
            <Skeleton height={80} />
          ) : complaintsQ.isError && complaintsQ.data === undefined ? (
            <BlockError error={complaintsQ.error} onRetry={() => void complaintsQ.refetch()} />
          ) : (complaintsQ.data ?? []).length === 0 ? (
            <Card>
              <Text muted>No active complaints assigned to you.</Text>
            </Card>
          ) : (
            <View style={{ gap: space[2] }}>
              {(complaintsQ.data ?? []).slice(0, 4).map((c) => (
                <ComplaintRow key={c.id} c={c} />
              ))}
            </View>
          )}
        </View>
      </Reveal>
    </ScrollView>
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
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
});
