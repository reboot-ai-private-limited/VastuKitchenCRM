import { useMemo } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import type { LeadDto } from '@vastu/contracts';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, radius, shadow, space } from '@/constants/theme';
import { CheckInCard } from '@/features/attendance/check-in-card';
import { STATUS_LABEL, STATUS_TONE } from '@/features/leads/lead-meta';
import { listLeads } from '@/lib/api/endpoints/leads';
import { useSession } from '@/lib/auth/session';
import { formatPhone, formatWeekdayDate, timeAgo } from '@/lib/format';

function ActionLeadCard({ lead }: { lead: LeadDto }) {
  const router = useRouter();
  const digits = lead.phone.replace(/\D/g, '').slice(-10);

  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/leads/[id]', params: { id: lead.id } } as Href)}
    >
      <Card style={styles.leadCard}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], flexWrap: 'wrap' }}>
            <Text variant="label" numberOfLines={1}>
              {lead.name}
            </Text>
            {lead.isStuck ? <Badge label="Stuck" t="danger" /> : null}
            <Badge label={STATUS_LABEL[lead.status]} t={STATUS_TONE[lead.status]} />
          </View>
          <Text variant="caption" muted style={{ fontVariant: ['tabular-nums'] }}>
            {formatPhone(lead.phone)}
            {lead.city ? `  ·  ${lead.city}` : ''}
          </Text>
          <Text variant="caption" muted>
            Updated {timeAgo(lead.statusChangedAt)}
          </Text>
        </View>
        <IconButton
          icon="phone"
          label={`Call ${lead.name}`}
          onPress={() => void Linking.openURL(`tel:${digits}`)}
        />
        <IconButton
          icon="message-circle"
          label={`WhatsApp ${lead.name}`}
          onPress={() => void Linking.openURL(`https://wa.me/91${digits}`)}
        />
      </Card>
    </PressableScale>
  );
}

export function SalesTodayHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useSession();

  const stuckQ = useQuery({
    queryKey: ['leads', 'today', 'stuck'],
    queryFn: ({ signal }) => listLeads({ page: 1, pageSize: 15, stuck: true }, signal),
  });

  const followUpQ = useQuery({
    queryKey: ['leads', 'today', 'follow-up'],
    queryFn: ({ signal }) => listLeads({ page: 1, pageSize: 15, status: 'FOLLOW_UP' }, signal),
  });

  const newQ = useQuery({
    queryKey: ['leads', 'today', 'new'],
    queryFn: ({ signal }) => listLeads({ page: 1, pageSize: 15, status: 'NEW' }, signal),
  });

  const priorityLeads = useMemo(() => {
    const map = new Map<string, LeadDto>();
    for (const l of stuckQ.data?.items ?? []) map.set(l.id, l);
    for (const l of followUpQ.data?.items ?? []) {
      if (!map.has(l.id)) map.set(l.id, l);
    }
    return Array.from(map.values()).slice(0, 8);
  }, [stuckQ.data, followUpQ.data]);

  const newLeads = (newQ.data?.items ?? []).slice(0, 8);
  const refreshing = stuckQ.isRefetching || followUpQ.isRefetching || newQ.isRefetching;

  const refreshAll = () => {
    void stuckQ.refetch();
    void followUpQ.refetch();
    void newQ.refetch();
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

        {/* STUCK & FOLLOW-UP */}
        <Reveal>
          <View style={{ gap: space[2] }}>
            <View style={styles.sectionHeader}>
              <Text variant="caption" muted style={styles.eyebrow}>
                STUCK & FOLLOW-UP ({priorityLeads.length})
              </Text>
              <PressableScale onPress={() => router.push('/leads' as Href)}>
                <Text variant="caption" color={colors.primary}>
                  All leads
                </Text>
              </PressableScale>
            </View>
            {stuckQ.isPending || followUpQ.isPending ? (
              <Skeleton height={88} />
            ) : priorityLeads.length === 0 ? (
              <Card>
                <Text muted>No stuck or follow-up leads waiting on you.</Text>
              </Card>
            ) : (
              <View style={{ gap: space[2] }}>
                {priorityLeads.map((lead) => (
                  <ActionLeadCard key={lead.id} lead={lead} />
                ))}
              </View>
            )}
          </View>
        </Reveal>

        {/* NEW LEADS */}
        <Reveal index={1}>
          <View style={{ gap: space[2] }}>
            <View style={styles.sectionHeader}>
              <Text variant="caption" muted style={styles.eyebrow}>
                NEW LEADS ({newQ.data?.total ?? newLeads.length})
              </Text>
              <PressableScale onPress={() => router.push('/proposals' as Href)}>
                <Text variant="caption" color={colors.primary}>
                  Proposals
                </Text>
              </PressableScale>
            </View>
            {newQ.isPending ? (
              <Skeleton height={88} />
            ) : newLeads.length === 0 ? (
              <Card>
                <Text muted>No fresh leads right now. Tap + to add one.</Text>
              </Card>
            ) : (
              <View style={{ gap: space[2] }}>
                {newLeads.map((lead) => (
                  <ActionLeadCard key={lead.id} lead={lead} />
                ))}
              </View>
            )}
          </View>
        </Reveal>
      </ScrollView>

      <PressableScale
        onPress={() => router.push('/leads/new' as Href)}
        accessibilityRole="button"
        accessibilityLabel="Add new lead"
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
  leadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
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
