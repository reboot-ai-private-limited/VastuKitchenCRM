import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, space } from '@/constants/theme';
import { CheckInCard } from '@/features/attendance/check-in-card';
import { STATUS_LABEL, STATUS_TONE } from '@/features/complaints/complaint-meta';
import { STAGE_LABEL, STAGE_TONE } from '@/features/projects/project-meta';
import { CompactTodoRow } from '@/features/todos/todos-screen';
import { useMyTodos } from '@/features/todos/use-todos';
import { listComplaints } from '@/lib/api/endpoints/complaints';
import { listProjects } from '@/lib/api/endpoints/projects';
import { useSession } from '@/lib/auth/session';
import { formatWeekdayDate, timeAgo } from '@/lib/format';

export function TechnicianTodayHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useSession();

  const complaintsQ = useQuery({
    queryKey: ['complaints', 'tech-mine'],
    queryFn: ({ signal }) => listComplaints({ page: 1, pageSize: 20, assignedTo: 'me' }, undefined, signal),
    select: (d) => d.items.filter((c) => c.status !== 'CLOSED'),
  });

  const todosQ = useMyTodos('open');

  const projectsQ = useQuery({
    queryKey: ['projects', 'tech-active'],
    queryFn: ({ signal }) => listProjects({ page: 1, pageSize: 12 }, signal),
    select: (d) => d.items.filter((p) => p.stage !== 'CLOSED'),
  });

  const refreshing = complaintsQ.isRefetching || todosQ.isRefetching || projectsQ.isRefetching;
  const refreshAll = () => {
    void complaintsQ.refetch();
    void todosQ.refetch();
    void projectsQ.refetch();
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

      {/* COMPLAINTS FOR ME (top section for Technician per 01-personas-and-navigation.md §2.5) */}
      <Reveal>
        <View style={{ gap: space[2] }}>
          <View style={styles.sectionHeader}>
            <Text variant="caption" muted style={styles.eyebrow}>
              COMPLAINTS FOR ME ({(complaintsQ.data ?? []).length})
            </Text>
            <PressableScale onPress={() => router.push('/complaints' as Href)}>
              <Text variant="caption" color={colors.primary}>
                All complaints
              </Text>
            </PressableScale>
          </View>
          {complaintsQ.isPending ? (
            <Skeleton height={100} />
          ) : (complaintsQ.data ?? []).length === 0 ? (
            <Card>
              <Text muted>No open service complaints assigned to you.</Text>
            </Card>
          ) : (
            <View style={{ gap: space[2] }}>
              {(complaintsQ.data ?? []).slice(0, 6).map((c) => (
                <Card key={c.id} style={{ gap: space[2] }}>
                  <View style={styles.rowBetween}>
                    <Text variant="section" numberOfLines={1} style={{ flex: 1 }}>
                      {c.projectName}
                    </Text>
                    <Badge label={STATUS_LABEL[c.status]} t={STATUS_TONE[c.status]} />
                  </View>
                  <Text numberOfLines={2}>{c.description}</Text>
                  <View style={styles.rowBetween}>
                    <Text variant="caption" muted>
                      {c.customer.name} · {timeAgo(c.createdAt)}
                    </Text>
                    <Button
                      title="Open"
                      size="sm"
                      variant="outline"
                      onPress={() =>
                        router.push({ pathname: '/complaints/[id]', params: { id: c.id } } as Href)
                      }
                    />
                  </View>
                </Card>
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
              MY TO-DOS ({(todosQ.data ?? []).length})
            </Text>
            <PressableScale onPress={() => router.push('/todos' as Href)}>
              <Text variant="caption" color={colors.primary}>
                Open all
              </Text>
            </PressableScale>
          </View>
          {todosQ.isPending ? (
            <Skeleton height={88} />
          ) : (todosQ.data ?? []).length === 0 ? (
            <Card>
              <Text muted>No open site to-dos right now.</Text>
            </Card>
          ) : (
            <View style={{ gap: space[2] }}>
              {(todosQ.data ?? []).slice(0, 6).map((t) => (
                <CompactTodoRow key={t.id} todo={t} />
              ))}
            </View>
          )}
        </View>
      </Reveal>

      {/* MY PROJECTS */}
      <Reveal index={2}>
        <View style={{ gap: space[2] }}>
          <View style={styles.sectionHeader}>
            <Text variant="caption" muted style={styles.eyebrow}>
              MY PROJECTS ({(projectsQ.data ?? []).length})
            </Text>
            <PressableScale onPress={() => router.push('/projects' as Href)}>
              <Text variant="caption" color={colors.primary}>
                View all
              </Text>
            </PressableScale>
          </View>
          {projectsQ.isPending ? (
            <Skeleton height={84} />
          ) : (projectsQ.data ?? []).length === 0 ? (
            <Card>
              <Text muted>No active projects assigned to you.</Text>
            </Card>
          ) : (
            <View style={{ gap: space[2] }}>
              {(projectsQ.data ?? []).slice(0, 6).map((p) => (
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
                        {p.siteAddress ?? p.customer.name}
                      </Text>
                    </View>
                    <Badge label={STAGE_LABEL[p.stage]} t={STAGE_TONE[p.stage]} />
                    <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                  </Card>
                </PressableScale>
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
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
});
