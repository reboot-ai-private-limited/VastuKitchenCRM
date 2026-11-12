import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { changeLeadStatusBodySchema, type LeadStatus } from '@vastu/contracts';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, font, radius, space, tone } from '@/constants/theme';
import { ApiError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { formatPhone } from '@/lib/format';
import { useCallLogger } from './call-logger';
import { VisitLog } from './visit-log';
import { STATUS_LABEL, STATUS_ORDER, STATUS_TONE } from './lead-meta';
import { useChangeLeadStatus, useLeadDetail } from './use-leads';

export function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const q = useLeadDetail(id);
  const change = useChangeLeadStatus(id);
  const callLogger = useCallLogger(id, q.data?.phone ?? '');
  const lead = q.data;

  const [lostSheetOpen, setLostSheetOpen] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [lostError, setLostError] = useState<string | null>(null);

  const isOffice = user?.role === 'OFFICE';
  const canChangeStatus =
    !isOffice &&
    (user?.role === 'ADMIN' || user?.role === 'SALES') &&
    (lead?.status !== 'WON' || user?.role === 'ADMIN');

  const open = (url: string) => void Linking.openURL(url);
  const wa = (phone: string) => `https://wa.me/91${phone.replace(/\D/g, '').slice(-10)}`;

  const handleConfirmLost = () => {
    const parsed = changeLeadStatusBodySchema.safeParse({
      status: 'LOST',
      lostReason: lostReason.trim() || undefined,
    });
    if (!parsed.success) {
      setLostError(parsed.error.issues[0]?.message ?? 'Give a reason when marking a lead as lost');
      return;
    }
    setLostError(null);
    change.mutate(parsed.data, {
      onSuccess: () => {
        setLostReason('');
        setLostSheetOpen(false);
      },
      onError: (err) => {
        setLostError(err.message);
      },
    });
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
          </View>
        </Reveal>

        {/* OFFICE leads are view/add only: no call or visit actions (01-personas-and-navigation.md §2.6). */}
        {!isOffice ? (
          <Reveal index={1}>
            <View style={{ flexDirection: 'row', gap: space[3] }}>
              <View style={{ flex: 1 }}>
                <Button title="Call" size="lg" onPress={callLogger.startCall} fullWidth />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="WhatsApp"
                  size="lg"
                  variant="outline"
                  onPress={() => open(wa(lead.phone))}
                  fullWidth
                />
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
          </Card>
        </Reveal>

        {!isOffice && (user?.role === 'ADMIN' || user?.role === 'SALES') ? (
          <Reveal index={3}>
            <VisitLog leadId={id} canAdd />
          </Reveal>
        ) : null}

        {canChangeStatus ? (
          <Reveal index={3}>
            <Text variant="section" style={{ marginBottom: space[2] }}>
              Move to
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
              {STATUS_ORDER.filter((s): s is LeadStatus => s !== lead.status).map((s) => (
                <PressableScale
                  key={s}
                  disabled={change.isPending}
                  onPress={() => {
                    if (s === 'LOST') {
                      setLostError(null);
                      setLostSheetOpen(true);
                    } else {
                      change.mutate(s);
                    }
                  }}
                  style={{
                    height: 38,
                    paddingHorizontal: 14,
                    borderRadius: radius.full,
                    backgroundColor: tone[STATUS_TONE[s]].bg,
                    justifyContent: 'center',
                    opacity: change.isPending ? 0.5 : 1,
                  }}
                >
                  <Text variant="caption" color={tone[STATUS_TONE[s]].fg}>
                    {STATUS_LABEL[s]}
                  </Text>
                </PressableScale>
              ))}
            </View>
            {change.isError ? (
              <Text variant="caption" color={colors.destructive} style={{ marginTop: space[2] }}>
                {change.error.message}
              </Text>
            ) : null}
          </Reveal>
        ) : null}
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
        contentContainerStyle={{ padding: space[4], paddingTop: space[1], paddingBottom: insets.bottom + space[8], gap: space[5] }}
      >
        {content}
      </ScrollView>

      {callLogger.sheet}

      <BottomSheet
        visible={lostSheetOpen}
        onClose={() => setLostSheetOpen(false)}
        title="Mark lead as lost"
        subtitle="Briefly record why this lead did not go ahead"
        footer={
          <Button
            title="Mark as lost"
            variant="destructive"
            size="lg"
            loading={change.isPending}
            onPress={handleConfirmLost}
            fullWidth
          />
        }
      >
        <View style={{ gap: space[2] }}>
          <TextInput
            value={lostReason}
            onChangeText={setLostReason}
            placeholder="e.g. Budget mismatch, went with carpenter, postponed"
            placeholderTextColor={colors.placeholder}
            multiline
            style={styles.reasonInput}
          />
          {lostError ? (
            <Text variant="caption" color={colors.destructive}>
              {lostError}
            </Text>
          ) : null}
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  reasonInput: {
    minHeight: 88,
    paddingHorizontal: space[3],
    paddingVertical: space[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.background,
    fontFamily: font.regular,
    fontSize: 16,
    color: colors.foreground,
    textAlignVertical: 'top',
  },
});
