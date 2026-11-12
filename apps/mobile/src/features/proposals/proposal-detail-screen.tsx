import { useState } from 'react';
import { Linking, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { RoleGate } from '@/components/ui/role-gate';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, font, hit, radius, space } from '@/constants/theme';
import { ApiError } from '@/lib/api/client';
import { formatDate, formatINR, formatPhone, timeAgo } from '@/lib/format';
import { normalizePhone } from '@/lib/phone';
import { newRequestId } from '@/lib/request-id';
import {
  useDuplicateProposal,
  useProposalDetail,
  useSendProposal,
  useSendProposalWhatsapp,
} from './use-proposals';

export function ProposalDetailScreen() {
  return (
    <RoleGate roles={['ADMIN', 'SALES']}>
      <ProposalDetail />
    </RoleGate>
  );
}

function ProposalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const q = useProposalDetail(id);
  const send = useSendProposal(id);
  const sendWa = useSendProposalWhatsapp(id);
  const duplicate = useDuplicateProposal(id);
  const p = q.data;

  const [waOpen, setWaOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [requestId, setRequestId] = useState('');
  const [waNote, setWaNote] = useState<string | null>(null);
  const [shareConfirmOpen, setShareConfirmOpen] = useState(false);
  const phoneOk = normalizePhone(phone) !== null;

  const openWaSheet = () => {
    if (!p) return;
    setPhone(p.customer.phone);
    setRequestId(newRequestId());
    setWaNote(null);
    sendWa.reset();
    setWaOpen(true);
  };

  const confirmWa = () => {
    const normalized = normalizePhone(phone);
    if (!normalized) return;
    // Only send `phone` when it differs from the lead's number (the API never changes the lead's number).
    const same = normalized === normalizePhone(p?.customer.phone ?? '');
    sendWa.mutate(
      { requestId, ...(same ? {} : { phone: normalized }) },
      {
        onSuccess: (res) => {
          setWaOpen(false);
          if (res.delivery === 'not_configured') {
            // Sending from here is not set up: open WhatsApp with the ready message instead.
            void Linking.openURL(res.whatsappUrl);
            return;
          }
          setWaNote(`Sent on WhatsApp to +91 ${res.sentTo}`);
        },
      },
    );
  };

  const shareLink = (url: string, title: string, number: string) =>
    void Share.share({ message: `${title} (${number}): ${url}`, url });

  const handleShareLink = () => {
    if (!p) return;
    if (p.publicUrl) {
      shareLink(p.publicUrl, p.title, p.number);
      return;
    }
    // A draft has no link yet: sharing sends it, which freezes it. Ask first.
    send.reset();
    setShareConfirmOpen(true);
  };

  const confirmShare = () => {
    send.mutate(undefined, {
      onSuccess: (res) => {
        setShareConfirmOpen(false);
        shareLink(res.publicUrl, res.proposal.title, res.proposal.number);
      },
    });
  };

  let body;
  if (q.isPending) {
    body = (
      <View style={{ gap: space[3] }}>
        <Skeleton height={28} width="65%" />
        <Skeleton height={160} />
      </View>
    );
  } else if (q.isError || !p) {
    const notFound = q.error instanceof ApiError && (q.error.status === 404 || q.error.status === 403);
    body = (
      <View style={{ gap: space[3], alignItems: 'center', paddingVertical: space[8] }}>
        <Text muted>{notFound ? 'Proposal could not be found.' : 'Could not load proposal.'}</Text>
        {!notFound ? <Button title="Retry" variant="outline" onPress={() => void q.refetch()} /> : null}
      </View>
    );
  } else {
    body = (
      <>
        <Reveal>
          <Text variant="caption" muted>
            {p.number}
          </Text>
          <Text variant="title">{p.title}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[2] }}>
            <Badge
              label={p.status === 'DRAFT' ? 'Draft' : p.seenCount > 0 ? `Seen ${p.seenCount}x` : 'Sent'}
              t={p.status === 'DRAFT' ? 'neutral' : p.seenCount > 0 ? 'accent' : 'info'}
            />
            {p.validUntil ? <Badge label={`Valid till ${formatDate(p.validUntil)}`} t="neutral" /> : null}
          </View>
        </Reveal>

        <Reveal index={1}>
          <View style={{ gap: space[2] }}>
            <Button
              title={p.status === 'DRAFT' ? 'Send via WhatsApp' : 'Send again on WhatsApp'}
              size="lg"
              onPress={openWaSheet}
              fullWidth
            />
            <View style={{ flexDirection: 'row', gap: space[3] }}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Share link"
                  variant="outline"
                  onPress={handleShareLink}
                  accessibilityHint={p.status === 'DRAFT' ? 'Asks before marking the draft as sent' : undefined}
                  fullWidth
                />
              </View>
              {p.publicUrl ? (
                <View style={{ flex: 1 }}>
                  <Button
                    title="Open preview"
                    variant="outline"
                    onPress={() => void Linking.openURL(p.publicUrl!)}
                    fullWidth
                  />
                </View>
              ) : null}
            </View>
            {p.status === 'DRAFT' ? (
              <Button
                title="Edit draft"
                variant="outline"
                onPress={() =>
                  router.push({ pathname: '/proposals/edit/[id]', params: { id: p.id } } as unknown as Href)
                }
                fullWidth
              />
            ) : null}
            <Button
              title="Duplicate as new draft"
              variant="ghost"
              loading={duplicate.isPending}
              onPress={() =>
                duplicate.mutate(undefined, {
                  onSuccess: (copy) =>
                    router.replace({ pathname: '/proposals/[id]', params: { id: copy.id } } as Href),
                })
              }
              fullWidth
            />
            {waNote ? (
              <Text variant="caption" color={colors.primary} accessibilityRole="alert">
                {waNote}
              </Text>
            ) : null}
            {duplicate.isError ? (
              <Text variant="caption" color={colors.destructive} accessibilityRole="alert">
                {duplicate.error.message}
              </Text>
            ) : null}
          </View>
        </Reveal>

        <Reveal index={2}>
          <Card style={{ gap: space[3] }}>
            <View>
              <Text variant="caption" muted>
                Customer
              </Text>
              <Text variant="label">{p.customer.name}</Text>
              <Text variant="caption" muted style={{ fontVariant: ['tabular-nums'] }}>
                {formatPhone(p.customer.phone)}
                {p.customer.city ? `  ·  ${p.customer.city}` : ''}
              </Text>
            </View>
            {p.customer.siteAddress ? (
              <View>
                <Text variant="caption" muted>
                  Site address
                </Text>
                <Text>{p.customer.siteAddress}</Text>
              </View>
            ) : null}
            <View style={{ gap: 2 }}>
              <Text variant="caption" muted>
                Customer engagement
              </Text>
              {p.status === 'DRAFT' ? (
                <Text>Not sent yet</Text>
              ) : (
                <>
                  <Text>
                    {p.sentAt ? `Sent ${formatDate(p.sentAt)} (${timeAgo(p.sentAt)})` : 'Sent'}
                  </Text>
                  {p.seenCount > 0 ? (
                    <>
                      <Text>
                        Opened {p.seenCount} time{p.seenCount === 1 ? '' : 's'}
                      </Text>
                      {p.firstSeenAt ? (
                        <Text variant="caption" muted>
                          First opened {formatDate(p.firstSeenAt)} ({timeAgo(p.firstSeenAt)})
                        </Text>
                      ) : null}
                      {p.lastSeenAt ? (
                        <Text variant="caption" muted>
                          Last opened {timeAgo(p.lastSeenAt)}
                        </Text>
                      ) : null}
                    </>
                  ) : (
                    <Text muted>Not opened yet</Text>
                  )}
                </>
              )}
            </View>
            <PressableScale
              onPress={() => router.push({ pathname: '/leads/[id]', params: { id: p.leadId } } as Href)}
              accessibilityLabel="Open lead"
              style={styles.leadLink}
            >
              <Text variant="caption" color={colors.primary}>
                Open lead
              </Text>
              <Feather name="arrow-right" size={14} color={colors.primary} />
            </PressableScale>
          </Card>
        </Reveal>

        <Reveal index={3}>
          <Card style={{ gap: space[3] }}>
            <Text variant="section">Items</Text>
            {p.items.map((item, idx) => (
              <View key={`${item.title}-${idx}`} style={styles.itemRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="label">{item.title}</Text>
                  {item.description ? (
                    <Text variant="caption" muted>
                      {item.description}
                    </Text>
                  ) : null}
                  <Text variant="caption" muted style={{ fontVariant: ['tabular-nums'] }}>
                    {item.quantity} × {formatINR(item.unitPrice)}
                  </Text>
                </View>
                <Text variant="label" style={{ fontVariant: ['tabular-nums'] }}>
                  {formatINR(item.lineTotal)}
                </Text>
              </View>
            ))}

            <View style={styles.divider} />

            <View style={styles.totalLine}>
              <Text muted>Subtotal</Text>
              <Text style={{ fontVariant: ['tabular-nums'] }}>{formatINR(p.subtotal)}</Text>
            </View>
            {p.discount > 0 ? (
              <View style={styles.totalLine}>
                <Text muted>Discount</Text>
                <Text color={colors.primary} style={{ fontVariant: ['tabular-nums'] }}>
                  − {formatINR(p.discount)}
                </Text>
              </View>
            ) : null}
            <View style={styles.totalLine}>
              <Text variant="section">Total</Text>
              <Text variant="title" style={{ fontVariant: ['tabular-nums'] }}>
                {formatINR(p.total)}
              </Text>
            </View>
          </Card>
        </Reveal>

        {p.whatsappSends.length > 0 ? (
          <Card style={{ gap: space[2] }}>
            <Text variant="section">WhatsApp sends</Text>
            {p.whatsappSends.map((w, i) => (
              <Text key={`${w.at}-${i}`} variant="caption" muted>
                {formatPhone(w.to)} · {timeAgo(w.at)}
                {w.by ? ` · by ${w.by.name}` : ''}
              </Text>
            ))}
          </Card>
        ) : null}

        {p.notes ? (
          <Card style={{ gap: space[1] }}>
            <Text variant="caption" muted>
              Notes
            </Text>
            <Text>{p.notes}</Text>
          </Card>
        ) : null}
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: p?.number ?? 'Proposal',
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
        visible={waOpen}
        onClose={() => setWaOpen(false)}
        title="Send on WhatsApp"
        subtitle={
          p?.status === 'DRAFT'
            ? 'Sending marks this proposal as sent and freezes it.'
            : 'The customer gets the proposal link as a WhatsApp message.'
        }
        footer={
          <Button
            title="Confirm and send"
            size="lg"
            loading={sendWa.isPending}
            disabled={!phoneOk}
            onPress={confirmWa}
            fullWidth
          />
        }
      >
        <View style={{ gap: space[1] }}>
          <Text variant="caption" muted>
            Send to (changes only this message, not the lead)
          </Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            accessibilityLabel="WhatsApp number"
            placeholderTextColor={colors.placeholder}
            style={styles.phoneInput}
          />
          {!phoneOk ? (
            <Text variant="caption" color={colors.destructive}>
              Enter a valid 10-digit mobile number
            </Text>
          ) : null}
          {sendWa.isError ? (
            <Text variant="caption" color={colors.destructive} accessibilityRole="alert">
              {sendWa.error.message}
            </Text>
          ) : null}
        </View>
      </BottomSheet>

      <BottomSheet
        visible={shareConfirmOpen}
        onClose={() => setShareConfirmOpen(false)}
        title="Share this draft?"
        subtitle="Sharing the link marks this proposal as sent and freezes it. To change it afterwards, duplicate it into a new draft."
        footer={
          <Button
            title="Mark as sent and share"
            size="lg"
            loading={send.isPending}
            onPress={confirmShare}
            fullWidth
          />
        }
      >
        {send.isError ? (
          <Text variant="caption" color={colors.destructive} accessibilityRole="alert">
            {send.error.message}
          </Text>
        ) : null}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  phoneInput: {
    height: hit,
    paddingHorizontal: space[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.input,
    fontFamily: font.regular,
    fontSize: 16,
    color: colors.foreground,
  },
  leadLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    minHeight: hit,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[3],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  totalLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
