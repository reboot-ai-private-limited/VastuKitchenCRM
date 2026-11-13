import { useState } from 'react';
import { Linking, RefreshControl, ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import type { LeadStatus } from '@vastu/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, radius, space, tone } from '@/constants/theme';
import { ApiError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { formatPhone } from '@/lib/format';
import { PendingSyncBadge } from '@/offline';
import { useCallLogger } from './call-logger';
import { STATUS_LABEL, STATUS_ORDER, STATUS_TONE } from './lead-meta';
import { CallsSection, ProposalsSection, TimelineSection } from './lead-sections';
import { AssignSheet, EditLeadSheet, StatusSheet } from './lead-sheets';
import { leadKey, useLeadDetail } from './use-leads';
import { VisitLog } from './visit-log';

export function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { user } = useSession();
  const q = useLeadDetail(id);
  const callLogger = useCallLogger(id, q.data?.phone ?? '');
  const lead = q.data;

  const [statusTarget, setStatusTarget] = useState<LeadStatus | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const role = user?.role;
  const isOffice = role === 'OFFICE';
  const isAdmin = role === 'ADMIN';
  const canWork = isAdmin || role === 'SALES'; // OFFICE is view/add only
  const canChangeStatus = canWork && (lead?.status !== 'WON' || isAdmin);

  const open = (url: string) => void Linking.openURL(url);
  const wa = (phone: string) => `https://wa.me/91${phone.replace(/\D/g, '').slice(-10)}`;

  const refresh = async () => {
    setRefreshing(true);
    try {
      await qc.invalidateQueries({ queryKey: ['leads'] });
      await qc.invalidateQueries({ queryKey: ['proposals', 'by-lead', id] });
    } finally {
      setRefreshing(false);
    }
  };

  let content;
  if (q.isPending) {
    content = (
      <View style={{ gap: space[3] }}>
        <Skeleton height={28} width="60%" />
        <Skeleton height={120} />
      </View>
    );
  } else if (q.isError || !lead) {
    const notFound = q.error instanceof ApiError && (q.error.status === 404 || q.error.status === 403);
    content = (
      <View style={{ gap: space[3], alignItems: 'center', paddingVertical: space[8] }}>
        <Text muted>{notFound ? 'This lead could not be found.' : 'Could not load this lead.'}</Text>
        {!notFound ? <Button title="Retry" variant="outline" onPress={() => void q.refetch()} /> : null}
      </View>
    );
  } else {
    const rows: [string, string | null | undefined][] = [
      ['Phone', formatPhone(lead.phone)],
      ['Alt phone', lead.altPhone ? formatPhone(lead.altPhone) : null],
      ['Email', lead.email],
      ['City', lead.city],
      ['Source', lead.source.replace(/_/g, ' ').toLowerCase()],
      ['Assigned to', lead.assignedTo?.name ?? 'Unassigned'],
      ['Lost reason', lead.lostReason],
      ['Notes', lead.notes],
    ];
    content = (
      <>
        <Reveal>
          <Text variant="title">{lead.name}</Text>
          <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[2], flexWrap: 'wrap' }}>
            <Badge label={STATUS_LABEL[lead.status]} t={STATUS_TONE[lead.status]} />
            {lead.isStuck ? <Badge label="Stuck" t="danger" /> : null}
            <PendingSyncBadge filter={(i) => i.entityKey === leadKey(id)} />
          </View>
        </Reveal>

        {/* OFFICE leads are view/add only: no call or visit actions (01-personas-and-navigation.md section 2.6). */}
        {canWork ? (
          <Reveal index={1}>
            <View style={{ flexDirection: 'row', gap: space[3] }}>
              <View style={{ flex: 1 }}>
                <Button title="Call" size="lg" onPress={callLogger.startCall} fullWidth />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="WhatsApp" size="lg" variant="outline" onPress={() => open(wa(lead.phone))} fullWidth />
              </View>
            </View>
          </Reveal>
        ) : null}

        <Reveal index={2}>
          <Card style={{ gap: space[3] }}>
            {rows
              .filter(([, v]) => !!v)
              .map(([k, v]) => (
                <View key={k}>
                  <Text variant="caption" muted>
                    {k}
                  </Text>
                  <Text>{v}</Text>
                </View>
              ))}
            {canWork || isAdmin ? (
              <View style={{ flexDirection: 'row', gap: space[2], flexWrap: 'wrap' }}>
                {canWork ? <Button title="Edit" size="sm" variant="outline" onPress={() => setEditOpen(true)} /> : null}
                {isAdmin ? (
                  <Button
                    title={lead.assignedTo ? 'Reassign' : 'Assign'}
                    size="sm"
                    variant="outline"
                    onPress={() => setAssignOpen(true)}
                  />
                ) : null}
              </View>
            ) : null}
          </Card>
        </Reveal>

        {canChangeStatus ? (
          <Reveal index={3}>
            <Text variant="section" style={{ marginBottom: space[2] }}>
              Move to
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
              {STATUS_ORDER.filter((s) => s !== lead.status).map((s) => (
                <PressableScale
                  key={s}
                  onPress={() => setStatusTarget(s)}
                  style={{
                    height: 38,
                    paddingHorizontal: 14,
                    borderRadius: radius.full,
                    backgroundColor: tone[STATUS_TONE[s]].bg,
                    justifyContent: 'center',
                  }}
                >
                  <Text variant="caption" color={tone[STATUS_TONE[s]].fg}>
                    {STATUS_LABEL[s]}
                  </Text>
                </PressableScale>
              ))}
            </View>
          </Reveal>
        ) : null}

        {canWork ? (
          <>
            <ProposalsSection leadId={id} canCreate />
            <CallsSection leadId={id} onLog={callLogger.logManually} />
            <VisitLog leadId={id} canAdd />
          </>
        ) : null}

        <TimelineSection leadId={id} />

        <EditLeadSheet lead={lead} visible={editOpen} onClose={() => setEditOpen(false)} />
        {isAdmin ? <AssignSheet lead={lead} visible={assignOpen} onClose={() => setAssignOpen(false)} /> : null}
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: '', headerShadowVisible: false, headerTintColor: colors.primary }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{
          padding: space[4],
          paddingTop: space[1],
          paddingBottom: insets.bottom + space[8],
          gap: space[5],
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />}
      >
        {content}
      </ScrollView>

      {isOffice ? null : callLogger.sheet}
      <StatusSheet leadId={id} target={statusTarget} onClose={() => setStatusTarget(null)} />
    </>
  );
}
