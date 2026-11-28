import { useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { toWaDigits, type LeadStatus } from '@vastu/contracts';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, font, hit, radius, space, tone } from '@/constants/theme';
import { SheetRow } from '@/features/projects/sheet-row';
import { ApiError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { formatPhone } from '@/lib/format';
import { softTick } from '@/lib/haptics';
import { PendingSyncBadge } from '@/offline';
import { useCallLogger } from './call-logger';
import { daysInStage, PRODUCT_LABEL, STATUS_LABEL, STATUS_ORDER, STATUS_TONE } from './lead-meta';
import { CallsSection, DesignsSection, ProposalsSection, TimelineSection } from './lead-sections';
import { AssignSheet, EditLeadSheet, StatusSheet } from './lead-sheets';
import { leadKey, useChangeLeadStatus, useLeadDetail } from './use-leads';
import { VisitLog } from './visit-log';

function stuckLabel(statusChangedAt: string): string {
  const days = daysInStage(statusChangedAt);
  if (days == null || days < 1) return 'Stuck';
  return `Stuck · ${days} ${days === 1 ? 'day' : 'days'} in stage`;
}

export function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useSession();
  const q = useLeadDetail(id);
  const changeStatus = useChangeLeadStatus(id);
  const callLogger = useCallLogger(id, q.data?.phone ?? '');
  const lead = q.data;

  const [stagePickerOpen, setStagePickerOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<LeadStatus | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const role = user?.role;
  const isAdmin = role === 'ADMIN';
  const isDesigner = role === 'DESIGNER';
  const canWork = isAdmin || role === 'SALES'; // OFFICE & DESIGNER have no call/edit/assign actions
  const canChangeStatus = canWork && (lead?.status !== 'WON' || isAdmin);
  const canViewVisits = canWork || isDesigner;
  const canCompleteDesign = (isAdmin || isDesigner) && lead?.status !== 'WON';
  const canMarkEstimateDone = isAdmin || role === 'SALES' || isDesigner;

  const open = (url: string) => void Linking.openURL(url);
  const wa = (phone: string) => `https://wa.me/${toWaDigits(phone)}`;

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
        <Skeleton height={44} />
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
    const metaRows: { label: string; value: string; numeric?: boolean }[] = [
      { label: 'Phone', value: formatPhone(lead.phone), numeric: true },
      ...(lead.altPhone ? [{ label: 'Alt phone', value: formatPhone(lead.altPhone), numeric: true }] : []),
      ...(lead.email ? [{ label: 'Email', value: lead.email }] : []),
      ...(lead.city ? [{ label: 'City', value: lead.city }] : []),
      ...(lead.productsOfInterest.length > 0
        ? [{ label: 'Interest', value: lead.productsOfInterest.map((p) => PRODUCT_LABEL[p]).join(', ') }]
        : []),
      { label: 'Source', value: lead.source.replace(/_/g, ' ').toLowerCase() },
      { label: 'Assigned', value: lead.assignedTo?.name ?? 'Unassigned' },
      ...(lead.lostReason ? [{ label: 'Lost reason', value: lead.lostReason }] : []),
    ];

    content = (
      <>
        <View style={{ gap: space[2] }}>
          <Text variant="title" color={colors.inkDeep}>
            {lead.name}
          </Text>
          <View style={styles.badgeRow}>
            <Badge label={STATUS_LABEL[lead.status]} t={STATUS_TONE[lead.status]} />
            {lead.isStuck ? (
              <View style={styles.stuckPill}>
                <View style={styles.stuckDot} />
                <Text variant="caption" color={tone.danger.fg} style={{ fontFamily: font.semibold }}>
                  {stuckLabel(lead.statusChangedAt)}
                </Text>
              </View>
            ) : null}
            <PendingSyncBadge filter={(i) => i.entityKey === leadKey(id)} />
          </View>
        </View>

        {/* OFFICE leads are view/add only: no call or visit actions (01-personas-and-navigation.md section 2.6). */}
        {canWork ? (
          <View style={styles.quickRow}>
            <PressableScale
              onPress={() => {
                softTick();
                callLogger.startCall();
              }}
              accessibilityRole="button"
              accessibilityLabel={`Call ${lead.name}`}
              style={styles.quickPrimary}
            >
              <Feather name="phone" size={16} color={colors.primaryForeground} />
              <Text variant="label" color={colors.primaryForeground} style={{ fontFamily: font.semibold }}>
                Call
              </Text>
            </PressableScale>
            <PressableScale
              onPress={() => {
                softTick();
                open(wa(lead.phone));
              }}
              accessibilityRole="button"
              accessibilityLabel={`WhatsApp ${lead.name}`}
              style={styles.quickSecondary}
            >
              <Feather name="message-circle" size={16} color={tone.success.fg} />
              <Text variant="label" color={colors.inkDeep} style={{ fontFamily: font.semibold }}>
                WhatsApp
              </Text>
            </PressableScale>
          </View>
        ) : null}

        {lead.status === 'DESIGN_ESTIMATE_SCHEDULED' && canMarkEstimateDone ? (
          <View style={styles.estimateBar}>
            <Text variant="label" color={tone.violet.fg} style={{ flex: 1, fontFamily: font.semibold }}>
              Estimate pending
            </Text>
            <Button
              title={changeStatus.isPending ? 'Updating...' : 'Mark estimate done'}
              size="sm"
              loading={changeStatus.isPending}
              onPress={() => {
                softTick();
                changeStatus.mutate('DESIGN_ESTIMATE_DONE');
              }}
            />
          </View>
        ) : null}

        {lead.status === 'DESIGN_ESTIMATE_DONE' && canWork ? (
          <View style={styles.proposalReadyBar}>
            <Text variant="label" color={tone.success.fg} style={{ flex: 1, fontFamily: font.semibold }}>
              Ready for proposal
            </Text>
            <Button
              title="Send WhatsApp proposal"
              size="sm"
              onPress={() => {
                softTick();
                router.push(`/proposals/new?leadId=${encodeURIComponent(id)}` as Href);
              }}
            />
          </View>
        ) : null}

        {canChangeStatus ? (
          <PressableScale
            onPress={() => {
              softTick();
              setStagePickerOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Stage: ${STATUS_LABEL[lead.status]}. Tap to change`}
            style={styles.stageControl}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="caption" color={colors.inkMuted}>
                Stage
              </Text>
              <Text variant="label" color={colors.inkDeep} style={{ fontFamily: font.semibold }}>
                {STATUS_LABEL[lead.status]}
              </Text>
            </View>
            <View style={styles.stageAction}>
              <Text variant="caption" color={colors.primaryPressed} style={{ fontFamily: font.semibold }}>
                Change
              </Text>
              <Feather name="chevron-down" size={16} color={colors.primaryPressed} />
            </View>
          </PressableScale>
        ) : null}

        <View style={styles.group}>
          {metaRows.map((row, i) => (
            <View key={row.label} style={[styles.metaRow, i > 0 && styles.rowDivider]}>
              <Text variant="caption" color={colors.inkMuted}>
                {row.label}
              </Text>
              <Text
                variant="label"
                color={colors.inkDeep}
                numberOfLines={2}
                style={[styles.metaValue, row.numeric && styles.tabular]}
              >
                {row.value}
              </Text>
            </View>
          ))}
          {lead.notes ? (
            <View style={[styles.notesRow, styles.rowDivider]}>
              <Text variant="caption" color={colors.inkMuted}>
                Notes
              </Text>
              <Text color={colors.inkDeep}>{lead.notes}</Text>
            </View>
          ) : null}
          {canWork || isAdmin ? (
            <View style={[styles.inlineActions, styles.rowDivider]}>
              {canWork ? (
                <PressableScale
                  onPress={() => setEditOpen(true)}
                  accessibilityRole="button"
                  style={styles.inlineActionBtn}
                >
                  <Feather name="edit-2" size={14} color={colors.inkMuted} />
                  <Text variant="caption" color={colors.inkDeep} style={{ fontFamily: font.semibold }}>
                    Edit details
                  </Text>
                </PressableScale>
              ) : null}
              {isAdmin ? (
                <PressableScale
                  onPress={() => setAssignOpen(true)}
                  accessibilityRole="button"
                  style={styles.inlineActionBtn}
                >
                  <Feather name="user-plus" size={14} color={colors.inkMuted} />
                  <Text variant="caption" color={colors.inkDeep} style={{ fontFamily: font.semibold }}>
                    {lead.assignedTo ? 'Reassign' : 'Assign'}
                  </Text>
                </PressableScale>
              ) : null}
            </View>
          ) : null}
        </View>

        {canWork ? (
          <>
            <ProposalsSection leadId={id} canCreate />
            <CallsSection leadId={id} onLog={callLogger.logManually} />
          </>
        ) : null}

        {canViewVisits ? <VisitLog leadId={id} canAdd={canWork} /> : null}

        <DesignsSection leadId={id} canComplete={canCompleteDesign} />

        <TimelineSection leadId={id} />

        <BottomSheet
          visible={stagePickerOpen}
          onClose={() => setStagePickerOpen(false)}
          title="Move stage"
        >
          <View style={{ gap: 2 }}>
            {STATUS_ORDER.map((s) => (
              <SheetRow
                key={s}
                icon={s === 'WON' ? 'check-circle' : s === 'LOST' ? 'x-circle' : 'circle'}
                label={STATUS_LABEL[s]}
                selected={s === lead.status}
                onPress={() => {
                  setStagePickerOpen(false);
                  if (s !== lead.status) {
                    softTick();
                    setStatusTarget(s);
                  }
                }}
              />
            ))}
          </View>
        </BottomSheet>

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
        style={{ flex: 1, backgroundColor: colors.card }}
        contentContainerStyle={{
          padding: space[4],
          paddingTop: space[1],
          paddingBottom: insets.bottom + space[8],
          gap: space[4],
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />}
      >
        {content}
      </ScrollView>

      {canWork ? callLogger.sheet : null}
      <StatusSheet leadId={id} target={statusTarget} onClose={() => setStatusTarget(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[2],
  },
  stuckPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: tone.danger.bg,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  stuckDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: tone.danger.fg,
  },
  quickRow: {
    flexDirection: 'row',
    gap: space[2],
  },
  quickPrimary: {
    flex: 1,
    minHeight: hit,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
  },
  quickSecondary: {
    flex: 1,
    minHeight: hit,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    backgroundColor: colors.pageSoft,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
  },
  stageControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: hit,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    backgroundColor: colors.pageSoft,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
  },
  stageAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  estimateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    backgroundColor: tone.violet.bg,
    borderRadius: radius.lg,
  },
  proposalReadyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    backgroundColor: tone.success.bg,
    borderRadius: radius.lg,
  },
  group: {
    backgroundColor: colors.pageSoft,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    paddingHorizontal: space[3],
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    minHeight: 42,
    paddingVertical: space[2],
  },
  metaValue: {
    flex: 1,
    textAlign: 'right',
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  notesRow: {
    gap: 4,
    paddingVertical: space[2],
  },
  inlineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    paddingVertical: space[2],
  },
  inlineActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
  },
});
