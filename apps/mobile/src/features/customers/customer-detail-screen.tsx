import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, Share, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  addCustomerPhoneBodySchema,
  MAX_CUSTOMER_ADDITIONAL_PHONES,
} from '@vastu/contracts';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PhoneField } from '@/components/ui/phone-field';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, hit, radius, space, tone } from '@/constants/theme';
import { describeActivity, STATUS_LABEL, STATUS_TONE } from '@/features/leads/lead-meta';
import { dayLabel } from '@/features/projects/chat-stream';
import { STAGE_LABEL, STAGE_TONE } from '@/features/projects/project-meta';
import { DaySeparator } from '@/features/projects/timeline-item';
import { RoleGate } from '@/components/ui/role-gate';
import { ApiError, NetworkError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { businessDate, formatDate, formatPhone, formatTime } from '@/lib/format';
import { openLink, telUrl, whatsappUrlFor } from '@/lib/phone';
import {
  useAddCustomerPhone,
  useCustomerDetail,
  useCustomerPhones,
  useCustomerTimeline,
  useInviteCustomer,
  useRemoveCustomerPhone,
  useStartNewProject,
} from './use-customers';

export function CustomerDetailScreen() {
  return (
    <RoleGate roles={['ADMIN', 'SALES', 'OFFICE']}>
      <CustomerDetail />
    </RoleGate>
  );
}

function CustomerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useSession();

  const q = useCustomerDetail(id);
  const c = q.data;
  const phonesQ = useCustomerPhones(id);
  const addPhone = useAddCustomerPhone(id);
  const removePhone = useRemoveCustomerPhone(id);
  const timeline = useCustomerTimeline(c?.leadId);
  const startNew = useStartNewProject(id);
  const invite = useInviteCustomer(id);

  const [confirmNewOpen, setConfirmNewOpen] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [addPhoneOpen, setAddPhoneOpen] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const canInvite = user?.role === 'ADMIN' || user?.role === 'SALES';
  const canManagePhones = canInvite;

  const submitPhone = () => {
    const parsed = addCustomerPhoneBodySchema.safeParse({ phone: newPhone });
    if (!parsed.success) {
      setPhoneError(parsed.error.issues[0]?.message ?? 'Enter a valid mobile number');
      return;
    }
    setPhoneError(null);
    addPhone.mutate(parsed.data.phone, {
      onSuccess: () => {
        setNewPhone('');
        setAddPhoneOpen(false);
      },
      onError: (err) => {
        setPhoneError(
          err instanceof NetworkError
            ? 'Connection lost. Check your internet and try again.'
            : err instanceof ApiError
              ? err.message
              : 'Could not add number',
        );
      },
    });
  };

  const confirmRemovePhone = (phone: string) =>
    Alert.alert('Remove login number?', `${formatPhone(phone)} will no longer be able to sign in.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          removePhone.mutate(phone, {
            onError: (err) =>
              Alert.alert('Could not remove number', err instanceof ApiError ? err.message : 'Try again.'),
          }),
      },
    ]);

  const handleInvite = () => {
    invite.mutate(undefined, {
      onSuccess: (res) => {
        setInviteUrl(res.url);
        void Share.share({
          message: `Welcome to Vastu Kitchen! View your kitchen project updates here: ${res.url}`,
          url: res.url,
        });
      },
    });
  };

  let body;
  if (q.isPending) {
    body = (
      <View style={{ gap: space[3] }}>
        <Skeleton height={28} width="60%" />
        <Skeleton height={120} />
      </View>
    );
  } else if (q.isError || !c) {
    const notFound = q.error instanceof ApiError && (q.error.status === 404 || q.error.status === 403);
    body = (
      <View style={{ gap: space[3], alignItems: 'center', paddingVertical: space[8] }}>
        <Text muted>{notFound ? 'Customer not found.' : 'Could not load customer.'}</Text>
        {!notFound ? <Button title="Retry" variant="outline" onPress={() => void q.refetch()} /> : null}
      </View>
    );
  } else {
    const additional = phonesQ.data?.additionalPhones ?? [];
    const primaryPhone = phonesQ.data?.primaryPhone ?? c.phone;
    const inProgress = c.leadStatus !== 'WON' && c.leadStatus !== 'LOST';
    const events = timeline.data ?? [];
    body = (
      <>
        <Reveal>
          <Text variant="title">{c.name}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[2] }}>
            <Badge label={STATUS_LABEL[c.leadStatus]} t={STATUS_TONE[c.leadStatus]} />
            {c.startedAgain ? <Badge label="New project in progress" t="info" /> : null}
          </View>
        </Reveal>

        <Reveal index={1}>
          <View style={{ flexDirection: 'row', gap: space[3] }}>
            <View style={{ flex: 1 }}>
              <Button
                title="Call"
                size="lg"
                onPress={() => void openLink(telUrl(c.phone))}
                fullWidth
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="WhatsApp"
                size="lg"
                variant="outline"
                onPress={() => void openLink(whatsappUrlFor(c.phone))}
                fullWidth
              />
            </View>
          </View>
        </Reveal>

        <Reveal index={2}>
          <Card style={{ gap: space[3] }}>
            <View>
              <Text variant="caption" muted>
                Phone
              </Text>
              <Text style={{ fontVariant: ['tabular-nums'] }}>{formatPhone(c.phone)}</Text>
            </View>
            {c.city ? (
              <View>
                <Text variant="caption" muted>
                  City
                </Text>
                <Text>{c.city}</Text>
              </View>
            ) : null}
            {c.owner ? (
              <View>
                <Text variant="caption" muted>
                  Sales owner
                </Text>
                <Text>{c.owner.name}</Text>
              </View>
            ) : null}
            <PressableScale
              onPress={() => router.push({ pathname: '/leads/[id]', params: { id: c.leadId } } as Href)}
              accessibilityLabel="Open linked lead record"
              style={styles.inlineLink}
            >
              <Text variant="caption" color={colors.primary}>
                Open linked lead record
              </Text>
              <Feather name="arrow-right" size={14} color={colors.primary} />
            </PressableScale>
          </Card>
        </Reveal>

        <View style={{ gap: space[2] }}>
          <View style={styles.sectionHeader}>
            <Text variant="section" style={{ fontVariant: ['tabular-nums'] }}>
              Login numbers ({additional.length + 1}/{MAX_CUSTOMER_ADDITIONAL_PHONES + 1})
            </Text>
            {canManagePhones && additional.length < MAX_CUSTOMER_ADDITIONAL_PHONES ? (
              <Button
                title="+ Add number"
                variant="outline"
                size="sm"
                onPress={() => {
                  setNewPhone('');
                  setPhoneError(null);
                  setAddPhoneOpen(true);
                }}
              />
            ) : null}
          </View>
          {phonesQ.isPending ? (
            <Skeleton height={52} />
          ) : phonesQ.isError ? (
            <View style={{ gap: space[2], alignItems: 'flex-start' }}>
              <Text variant="caption" muted>
                Could not load login numbers.
              </Text>
              <Button title="Retry" variant="outline" size="sm" onPress={() => void phonesQ.refetch()} />
            </View>
          ) : (
            <View style={styles.phoneGroup}>
              <View style={styles.phoneRow}>
                <Text variant="label" color={colors.inkDeep} style={{ flex: 1, fontVariant: ['tabular-nums'] }}>
                  {formatPhone(primaryPhone)}
                </Text>
                <Badge label="Primary" t="accent" />
              </View>
              {additional.map((phone) => (
                <View key={phone} style={[styles.phoneRow, styles.phoneDivider]}>
                  <Text variant="label" color={colors.inkDeep} style={{ flex: 1, fontVariant: ['tabular-nums'] }}>
                    {formatPhone(phone)}
                  </Text>
                  {canManagePhones ? (
                    <PressableScale
                      onPress={() => confirmRemovePhone(phone)}
                      disabled={removePhone.isPending}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${formatPhone(phone)}`}
                      hitSlop={10}
                      style={styles.removeBtn}
                    >
                      <Feather name="trash-2" size={16} color={colors.destructive} />
                    </PressableScale>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </View>

        {canInvite ? (
          <Reveal index={3}>
            <Card style={{ gap: space[2] }}>
              <Text variant="label">Customer app access</Text>
              <Text variant="caption" muted>
                Generate a one-time invite link or let the customer sign in with OTP on {formatPhone(c.phone)}.
              </Text>
              <Button
                title="Share invite link"
                variant="outline"
                size="sm"
                loading={invite.isPending}
                onPress={handleInvite}
              />
              {inviteUrl ? (
                <Text variant="caption" color={colors.primary} selectable>
                  {inviteUrl}
                </Text>
              ) : null}
              {invite.isError ? (
                <Text variant="caption" color={colors.destructive}>
                  {invite.error.message}
                </Text>
              ) : null}
            </Card>
          </Reveal>
        ) : null}

        <View style={{ gap: space[3] }}>
          <View style={styles.sectionHeader}>
            <Text variant="section">Projects ({c.projects.length})</Text>
            {!inProgress ? (
              <Button
                title="Start new project"
                variant="ghost"
                size="sm"
                onPress={() => {
                  setStartError(null);
                  setConfirmNewOpen(true);
                }}
              />
            ) : null}
          </View>
          {inProgress ? (
            <View style={styles.inProgressBanner}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                <Badge label={STATUS_LABEL[c.leadStatus]} t={STATUS_TONE[c.leadStatus]} />
                <Text variant="caption" color={colors.inkDeep} style={{ flex: 1 }}>
                  {c.projects.length > 0
                    ? 'A new project is being planned.'
                    : 'Their first project is being planned.'}
                </Text>
              </View>
              <Button
                title="Continue on the lead"
                variant="outline"
                size="sm"
                onPress={() => router.push({ pathname: '/leads/[id]', params: { id: c.leadId } } as Href)}
              />
            </View>
          ) : null}
          {c.projects.length === 0 ? (
            <Text muted>No projects created yet.</Text>
          ) : (
            c.projects.map((p) => (
              <PressableScale
                key={p.id}
                onPress={() => router.push({ pathname: '/projects/[id]', params: { id: p.id } } as Href)}
              >
                <Card style={styles.projectRow}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="label">{p.name}</Text>
                    <Text variant="caption" muted>
                      Started {formatDate(p.createdAt)}
                    </Text>
                  </View>
                  <Badge label={STAGE_LABEL[p.stage]} t={STAGE_TONE[p.stage]} />
                  <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                </Card>
              </PressableScale>
            ))
          )}
        </View>

        <View style={{ gap: space[3] }}>
          <Text variant="section">Activity timeline</Text>
          {timeline.isPending ? (
            <Skeleton height={80} />
          ) : timeline.isError ? (
            <View style={{ gap: space[2], alignItems: 'flex-start' }}>
              <Text muted>
                {timeline.error instanceof ApiError && timeline.error.status === 403
                  ? 'Timeline unavailable for your role.'
                  : timeline.error instanceof NetworkError
                    ? 'Connection lost. Check your internet and try again.'
                    : `Could not load the timeline: ${timeline.error.message}`}
              </Text>
              <Button title="Retry" variant="outline" size="sm" onPress={() => void timeline.refetch()} />
            </View>
          ) : events.length === 0 ? (
            <Text muted>No timeline events yet.</Text>
          ) : (
            <View style={{ gap: space[1] }}>
              {events.map((ev, idx) => {
                const prev = events[idx - 1];
                const newDay = !prev || businessDate(prev.at) !== businessDate(ev.at);
                const desc = describeActivity(ev);
                const actor = ev.by?.name ?? 'System';
                const isLast = idx === events.length - 1;
                return (
                  <View key={ev.id}>
                    {newDay ? <DaySeparator label={dayLabel(ev.at)} /> : null}
                    <View style={styles.timelineItem}>
                      <View style={styles.timelineRail}>
                        <Avatar name={actor} size={32} accent={ev.by?.id === user?.id} />
                        {!isLast ? <View style={styles.timelineLine} /> : null}
                      </View>
                      <View style={styles.timelineContent}>
                        <Text variant="label" color={colors.inkDeep}>
                          {desc.title}
                        </Text>
                        {desc.detail ? (
                          <Text variant="caption" color={colors.inkMuted}>
                            {desc.detail}
                          </Text>
                        ) : null}
                        <Text variant="caption" color={colors.inkMuted} style={{ fontVariant: ['tabular-nums'] }}>
                          {formatTime(ev.at)}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Customer',
          headerShadowVisible: false,
          headerTintColor: colors.primary,
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{
          padding: space[4],
          paddingBottom: insets.bottom + space[8],
          gap: space[5],
        }}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching || phonesQ.isRefetching || timeline.isRefetching}
            onRefresh={() => {
              void q.refetch();
              void phonesQ.refetch();
              void timeline.refetch();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {body}
      </ScrollView>

      <BottomSheet
        visible={addPhoneOpen}
        onClose={() => setAddPhoneOpen(false)}
        title="Add login number"
        subtitle={`Up to ${MAX_CUSTOMER_ADDITIONAL_PHONES} additional numbers can sign in with OTP.`}
        footer={
          <Button
            title="Add number"
            size="lg"
            loading={addPhone.isPending}
            onPress={submitPhone}
            fullWidth
          />
        }
      >
        <View style={{ gap: space[2] }}>
          <PhoneField value={newPhone} onChangeText={setNewPhone} accessibilityLabel="Additional login number" />
          {phoneError ? (
            <Text variant="caption" color={colors.destructive}>
              {phoneError}
            </Text>
          ) : null}
        </View>
      </BottomSheet>

      <BottomSheet
        visible={confirmNewOpen}
        onClose={() => setConfirmNewOpen(false)}
        title="Start another project?"
        subtitle="Re-opens the customer's sales pipeline so a fresh proposal and project can be created."
        footer={
          <Button
            title="Confirm & start"
            size="lg"
            loading={startNew.isPending}
            onPress={() => {
              setStartError(null);
              startNew.mutate(undefined, {
                onSuccess: (updated) => {
                  setConfirmNewOpen(false);
                  router.push({ pathname: '/leads/[id]', params: { id: updated.leadId } } as Href);
                },
                onError: (err) =>
                  setStartError(
                    err instanceof ApiError ? err.message : 'Could not start a new project.',
                  ),
              });
            }}
            fullWidth
          />
        }
      >
        <View style={{ gap: space[2] }}>
          <Text muted>
            Existing projects and history stay untouched. Your sales team can immediately prepare a new quote.
          </Text>
          {startError ? (
            <Text variant="caption" color={colors.destructive}>
              {startError}
            </Text>
          ) : null}
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  inlineLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    minHeight: 48,
  },
  phoneGroup: {
    backgroundColor: colors.pageSoft,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    paddingHorizontal: space[3],
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    minHeight: hit,
    paddingVertical: space[2],
  },
  phoneDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  removeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inProgressBanner: {
    padding: space[3],
    borderRadius: radius.lg,
    backgroundColor: tone.info.bg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: space[2],
  },
  timelineItem: {
    flexDirection: 'row',
    gap: space[3],
  },
  timelineRail: {
    alignItems: 'center',
    width: 32,
  },
  timelineLine: {
    flex: 1,
    width: 1.5,
    backgroundColor: colors.border,
    marginVertical: 4,
    minHeight: 16,
  },
  timelineContent: {
    flex: 1,
    gap: 2,
    paddingBottom: space[4],
  },
});
