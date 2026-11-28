import { useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  addCustomerPhoneBodySchema,
  MAX_CUSTOMER_ADDITIONAL_PHONES,
  type LeadActivityDto,
} from '@vastu/contracts';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PhoneField } from '@/components/ui/phone-field';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, hit, radius, space } from '@/constants/theme';
import { STATUS_LABEL, STATUS_TONE } from '@/features/leads/lead-meta';
import { STAGE_LABEL, STAGE_TONE } from '@/features/projects/project-meta';
import { RoleGate } from '@/components/ui/role-gate';
import { ApiError, NetworkError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { formatDate, formatPhone, timeAgo } from '@/lib/format';
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

const ACTIVITY_LABEL: Record<LeadActivityDto['type'], string> = {
  CREATED: 'Record created',
  ASSIGNED: 'Owner assigned',
  STATUS_CHANGED: 'Lead status updated',
  CALL: 'Phone call logged',
  VISIT: 'Site visit logged',
  DESIGN_COMPLETED: 'Design completed',
  PROPOSAL_SENT: 'Proposal sent',
  PROPOSAL_SEEN: 'Proposal viewed by customer',
  PROJECT_CREATED: 'Project started',
  PROJECT_CLOSED: 'Project closed',
};

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
            <Text variant="section">Login numbers</Text>
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
            {!c.startedAgain ? (
              <Button
                title="Start new project"
                variant="ghost"
                size="sm"
                onPress={() => setConfirmNewOpen(true)}
              />
            ) : null}
          </View>
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
          ) : (timeline.data ?? []).length === 0 ? (
            <Text muted>No timeline events yet.</Text>
          ) : (
            (timeline.data ?? []).slice(0, 12).map((ev) => (
              <Card key={ev.id} style={{ gap: 2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
                  <Text variant="label">{ACTIVITY_LABEL[ev.type]}</Text>
                  <Text variant="caption" muted>
                    {timeAgo(ev.at)}
                  </Text>
                </View>
                {ev.by ? (
                  <Text variant="caption" muted>
                    by {ev.by.name}
                  </Text>
                ) : null}
              </Card>
            ))
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
            onPress={() =>
              startNew.mutate(undefined, {
                onSuccess: () => setConfirmNewOpen(false),
              })
            }
            fullWidth
          />
        }
      >
        <Text muted>
          Existing projects and history stay untouched. Your sales team can immediately prepare a new quote.
        </Text>
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
});
