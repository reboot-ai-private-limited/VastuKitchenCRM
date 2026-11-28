import type React from 'react';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import {
  DEFAULT_PROPOSAL_TEMPLATE_KEY,
  MAX_PROPOSAL_ITEMS,
  createProposalBodySchema,
  updateProposalBodySchema,
  type ProposalDto,
} from '@vastu/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { RoleGate } from '@/components/ui/role-gate';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, font, hit, radius, space } from '@/constants/theme';
import { STATUS_LABEL, STATUS_TONE } from '@/features/leads/lead-meta';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { ApiError, NetworkError } from '@/lib/api/client';
import { getLead, listLeads } from '@/lib/api/endpoints/leads';
import { useSession } from '@/lib/auth/session';
import { formatINR, formatPhone } from '@/lib/format';
import { ProposalPreview } from './proposal-preview';
import {
  useCreateProposal,
  useDeleteProposal,
  useProposalDetail,
  useProposalTemplates,
  useUpdateProposal,
} from './use-proposals';

type ItemForm = { title: string; description: string; quantity: string; unitPrice: string };
const blankItem = (): ItemForm => ({ title: '', description: '', quantity: '1', unitPrice: '' });

function addDaysYmd(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Create (?leadId, or pick a lead) or edit a DRAFT (/proposals/edit/[id]). */
export function ProposalFormScreen() {
  return (
    <RoleGate roles={['ADMIN', 'SALES']}>
      <FormRouter />
    </RoleGate>
  );
}

function FormRouter() {
  const { id, leadId } = useLocalSearchParams<{ id?: string; leadId?: string }>();
  if (id) return <EditLoader id={id} />;
  if (leadId) return <ProposalForm leadId={leadId} />;
  return <LeadPicker />;
}

function EditLoader({ id }: { id: string }) {
  const q = useProposalDetail(id);
  if (q.isPending) return <Loading />;
  if (q.isError || !q.data) {
    return (
      <Centered>
        <Text muted>Could not load this proposal.</Text>
        <Button title="Retry" variant="outline" onPress={() => void q.refetch()} />
      </Centered>
    );
  }
  if (q.data.status !== 'DRAFT') {
    return (
      <Centered>
        <Text muted style={{ textAlign: 'center' }}>
          This proposal has been sent and is frozen. Duplicate it into a new draft to change it.
        </Text>
      </Centered>
    );
  }
  return <ProposalForm leadId={q.data.leadId} existing={q.data} />;
}

function Loading() {
  return (
    <View style={{ padding: space[4], gap: space[3], backgroundColor: colors.background, flex: 1 }}>
      <Skeleton height={28} width="60%" />
      <Skeleton height={160} />
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space[3],
        padding: space[6],
        backgroundColor: colors.background,
      }}
    >
      {children}
    </View>
  );
}

/** No ?leadId: choose the lead this proposal is for. */
function LeadPicker() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search.trim(), 300);
  const q = useQuery({
    queryKey: ['leads', 'picker', term],
    queryFn: ({ signal }) => listLeads({ page: 1, pageSize: 20, search: term || undefined }, signal),
  });
  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: 'New proposal', headerShadowVisible: false, headerTintColor: colors.primary }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: space[4], gap: space[3] }}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="section">Which lead is this for?</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search name or phone"
          placeholderTextColor={colors.placeholder}
          accessibilityLabel="Search leads"
          style={styles.input}
        />
        {q.isPending ? <Skeleton height={64} /> : null}
        {q.isError ? <Text color={colors.destructive}>Could not load leads.</Text> : null}
        {q.data?.items.length === 0 ? <Text muted>No leads found.</Text> : null}
        {q.data?.items.map((l) => (
          <PressableScale
            key={l.id}
            accessibilityLabel={`Create proposal for ${l.name}`}
            onPress={() => router.replace({ pathname: '/proposals/new', params: { leadId: l.id } } as unknown as Href)}
          >
            <Card style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] }}>
                <Text variant="label" numberOfLines={1} style={{ flex: 1 }}>
                  {l.name}
                </Text>
                <Badge label={STATUS_LABEL[l.status]} t={STATUS_TONE[l.status]} />
              </View>
              <Text variant="caption" muted style={{ fontVariant: ['tabular-nums'] }}>
                {formatPhone(l.phone)}
                {l.city ? ` · ${l.city}` : ''}
              </Text>
            </Card>
          </PressableScale>
        ))}
      </ScrollView>
    </>
  );
}

function ProposalForm({ leadId, existing }: { leadId: string; existing?: ProposalDto }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useSession();
  const create = useCreateProposal();
  const update = useUpdateProposal(existing?.id ?? '');
  const delMut = useDeleteProposal();
  const templatesQ = useProposalTemplates();
  const leadQ = useQuery({
    queryKey: ['leads', 'detail', leadId],
    queryFn: ({ signal }) => getLead(leadId, signal),
    enabled: !existing && !!leadId,
  });

  const [templateKey, setTemplateKey] = useState(
    existing?.templateKey ?? DEFAULT_PROPOSAL_TEMPLATE_KEY,
  );
  const [title, setTitle] = useState(existing?.title ?? 'Modular kitchen proposal');
  const [siteAddress, setSiteAddress] = useState(existing?.customer.siteAddress ?? '');
  const [items, setItems] = useState<ItemForm[]>(
    existing
      ? existing.items.map((i) => ({
          title: i.title,
          description: i.description ?? '',
          quantity: String(i.quantity),
          unitPrice: String(i.unitPrice),
        }))
      : [blankItem()],
  );
  const [discount, setDiscount] = useState(existing ? String(existing.discount) : '0');
  const [validDate, setValidDate] = useState(
    existing?.validUntil ? existing.validUntil.slice(0, 10) : addDaysYmd(15),
  );
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [terms, setTerms] = useState(existing?.terms ?? '');
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const customerName = existing?.customer.name ?? leadQ.data?.name ?? null;
  const customerPhone = existing?.customer.phone ?? leadQ.data?.phone ?? null;
  const customerCity = existing?.customer.city ?? leadQ.data?.city ?? null;
  const templates = templatesQ.data?.items ?? [];
  const canDeleteDraft =
    !!existing && (user?.role === 'ADMIN' || existing.createdBy?.id === user?.id);

  const setItem = (i: number, patch: Partial<ItemForm>) =>
    setItems((cur) => cur.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const moveItem = (from: number, to: number) =>
    setItems((cur) => {
      if (to < 0 || to >= cur.length) return cur;
      const next = [...cur];
      const [moved] = next.splice(from, 1);
      if (moved) next.splice(to, 0, moved);
      return next;
    });

  const parsedItems = items.map((it) => ({
    title: it.title.trim(),
    ...(it.description.trim() ? { description: it.description.trim() } : {}),
    quantity: Number(it.quantity),
    unitPrice: Number(it.unitPrice),
  }));
  const subtotal = parsedItems.reduce(
    (s, i) =>
      s + (Number.isFinite(i.quantity) && Number.isFinite(i.unitPrice) ? Math.round(i.quantity * i.unitPrice) : 0),
    0,
  );
  const discountN = Number(discount || '0');
  const shownDiscount = Number.isFinite(discountN) ? discountN : 0;
  const total = Math.max(0, subtotal - shownDiscount);

  const parsedValidUntil = (): string | null | 'invalid' => {
    const clean = validDate.trim();
    if (!clean) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return 'invalid';
    const d = new Date(`${clean}T23:59:59.000Z`);
    return Number.isNaN(d.getTime()) ? 'invalid' : d.toISOString();
  };

  const submit = (openSendAfter = false) => {
    setError(null);
    const validIso = parsedValidUntil();
    if (validIso === 'invalid') {
      setError('Valid until must be YYYY-MM-DD (or leave empty).');
      return;
    }
    if (!Number.isFinite(discountN) || discountN > subtotal) {
      setError('Discount cannot be more than the subtotal.');
      return;
    }
    const done = (p: ProposalDto) =>
      router.replace({
        pathname: '/proposals/[id]',
        params: openSendAfter ? { id: p.id, send: '1' } : { id: p.id },
      } as Href);

    if (existing) {
      const r = updateProposalBodySchema.safeParse({
        title: title.trim(),
        templateKey,
        items: parsedItems,
        discount: discountN,
        validUntil: validIso,
        siteAddress: siteAddress.trim() || null,
        notes: notes.trim() || null,
        terms: terms.trim() || null,
      });
      if (!r.success) {
        setError(r.error.issues[0]?.message ?? 'Check the form.');
        return;
      }
      update.mutate(r.data, { onSuccess: done });
    } else {
      const r = createProposalBodySchema.safeParse({
        leadId,
        title: title.trim(),
        templateKey,
        items: parsedItems,
        discount: discountN,
        ...(validIso ? { validUntil: validIso } : {}),
        ...(siteAddress.trim() ? { siteAddress: siteAddress.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(terms.trim() ? { terms: terms.trim() } : {}),
      });
      if (!r.success) {
        setError(r.error.issues[0]?.message ?? 'Check the form.');
        return;
      }
      create.mutate(r.data, { onSuccess: done });
    }
  };

  const confirmDeleteDraft = () => {
    if (!existing) return;
    Alert.alert(`Delete ${existing.number}?`, 'This draft will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          delMut.mutate(existing.id, {
            onSuccess: () => router.replace('/proposals' as Href),
            onError: (err) =>
              Alert.alert('Could not delete', err instanceof ApiError ? err.message : 'Try again.'),
          }),
      },
    ]);
  };

  const mutation = existing ? update : create;
  const apiError = mutation.error
    ? mutation.error instanceof NetworkError
      ? 'Connection lost. Check your internet and try again.'
      : mutation.error.message
    : null;

  const previewValidIso = parsedValidUntil();

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: existing ? `Edit ${existing.number}` : 'New proposal',
          headerShadowVisible: false,
          headerTintColor: colors.primary,
        }}
      />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: space[4], paddingBottom: insets.bottom + space[8], gap: space[4] }}
        >
          {customerName ? (
            <Card style={{ gap: 2 }}>
              <Text variant="caption" muted>
                Customer
              </Text>
              <Text variant="label">{customerName}</Text>
              {customerPhone ? (
                <Text variant="caption" muted style={{ fontVariant: ['tabular-nums'] }}>
                  {formatPhone(customerPhone)}
                  {customerCity ? ` · ${customerCity}` : ''}
                </Text>
              ) : null}
            </Card>
          ) : null}

          {templates.length > 0 ? (
            <Field label="Template">
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: space[2] }}>
                  {templates.map((t) => {
                    const active = templateKey === t.key;
                    return (
                      <PressableScale
                        key={t.key}
                        onPress={() => setTemplateKey(t.key)}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text
                          variant="caption"
                          color={active ? colors.primaryForeground : colors.inkDeep}
                          style={{ fontFamily: active ? font.semibold : font.medium }}
                        >
                          {t.name}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </View>
              </ScrollView>
            </Field>
          ) : null}

          <Field label="Title">
            <TextInput value={title} onChangeText={setTitle} style={styles.input} accessibilityLabel="Title" />
          </Field>
          <Field label="Site address (optional)">
            <TextInput
              value={siteAddress}
              onChangeText={setSiteAddress}
              style={styles.input}
              accessibilityLabel="Site address"
            />
          </Field>

          <Text variant="section">Items</Text>
          {items.map((it, i) => {
            const qty = Number(it.quantity);
            const price = Number(it.unitPrice);
            const lineTotal =
              Number.isFinite(qty) && Number.isFinite(price) ? Math.round(qty * price) : 0;
            return (
              <Card key={i} style={{ gap: space[2] }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text variant="caption" muted style={{ fontVariant: ['tabular-nums'] }}>
                    Item {i + 1} · {formatINR(lineTotal)}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <PressableScale
                      disabled={i === 0}
                      onPress={() => moveItem(i, i - 1)}
                      accessibilityLabel="Move item up"
                      style={[styles.orderBtn, i === 0 && { opacity: 0.35 }]}
                    >
                      <Feather name="arrow-up" size={14} color={colors.inkDeep} />
                    </PressableScale>
                    <PressableScale
                      disabled={i === items.length - 1}
                      onPress={() => moveItem(i, i + 1)}
                      accessibilityLabel="Move item down"
                      style={[styles.orderBtn, i === items.length - 1 && { opacity: 0.35 }]}
                    >
                      <Feather name="arrow-down" size={14} color={colors.inkDeep} />
                    </PressableScale>
                  </View>
                </View>
                <TextInput
                  value={it.title}
                  onChangeText={(v) => setItem(i, { title: v })}
                  placeholder="Item (e.g. Modular kitchen)"
                  placeholderTextColor={colors.placeholder}
                  style={styles.input}
                  accessibilityLabel={`Item ${i + 1} title`}
                />
                <TextInput
                  value={it.description}
                  onChangeText={(v) => setItem(i, { description: v })}
                  placeholder="Description (optional)"
                  placeholderTextColor={colors.placeholder}
                  style={styles.input}
                  accessibilityLabel={`Item ${i + 1} description`}
                />
                <View style={{ flexDirection: 'row', gap: space[2] }}>
                  <TextInput
                    value={it.quantity}
                    onChangeText={(v) => setItem(i, { quantity: v })}
                    keyboardType="decimal-pad"
                    placeholder="Qty"
                    placeholderTextColor={colors.placeholder}
                    style={[styles.input, { flex: 1 }]}
                    accessibilityLabel={`Item ${i + 1} quantity`}
                  />
                  <TextInput
                    value={it.unitPrice}
                    onChangeText={(v) => setItem(i, { unitPrice: v.replace(/[^0-9]/g, '') })}
                    keyboardType="number-pad"
                    placeholder="Unit price (Rs)"
                    placeholderTextColor={colors.placeholder}
                    style={[styles.input, { flex: 2 }]}
                    accessibilityLabel={`Item ${i + 1} unit price`}
                  />
                </View>
                {items.length > 1 ? (
                  <Button
                    title="Remove item"
                    variant="ghost"
                    onPress={() => setItems((c) => c.filter((_, x) => x !== i))}
                  />
                ) : null}
              </Card>
            );
          })}
          {items.length < MAX_PROPOSAL_ITEMS ? (
            <Button title="Add item" variant="outline" onPress={() => setItems((c) => [...c, blankItem()])} fullWidth />
          ) : null}

          <Field label="Discount (Rs)">
            <TextInput
              value={discount}
              onChangeText={(v) => setDiscount(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              style={styles.input}
              accessibilityLabel="Discount"
            />
          </Field>
          <Field label="Valid until (optional, YYYY-MM-DD)">
            <TextInput
              value={validDate}
              onChangeText={setValidDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.placeholder}
              style={styles.input}
              accessibilityLabel="Valid until date"
            />
            <View style={styles.chipWrap}>
              <PressableScale onPress={() => setValidDate(addDaysYmd(7))} style={styles.chip}>
                <Text variant="caption" color={colors.inkDeep}>
                  +7 days
                </Text>
              </PressableScale>
              <PressableScale onPress={() => setValidDate(addDaysYmd(15))} style={styles.chip}>
                <Text variant="caption" color={colors.inkDeep}>
                  +15 days
                </Text>
              </PressableScale>
              <PressableScale onPress={() => setValidDate(addDaysYmd(30))} style={styles.chip}>
                <Text variant="caption" color={colors.inkDeep}>
                  +30 days
                </Text>
              </PressableScale>
              {validDate ? (
                <PressableScale onPress={() => setValidDate('')} style={styles.chip}>
                  <Text variant="caption" color={colors.destructive}>
                    Clear
                  </Text>
                </PressableScale>
              ) : null}
            </View>
          </Field>
          <Field label="Notes (optional)">
            <TextInput
              value={notes}
              onChangeText={setNotes}
              multiline
              style={[styles.input, { height: 96, paddingTop: space[2], textAlignVertical: 'top' }]}
              accessibilityLabel="Notes"
            />
          </Field>
          <Field label="Terms & conditions (optional — blank uses company default)">
            <TextInput
              value={terms}
              onChangeText={setTerms}
              multiline
              style={[styles.input, { height: 112, paddingTop: space[2], textAlignVertical: 'top' }]}
              accessibilityLabel="Terms and conditions"
            />
          </Field>

          <Card style={{ gap: space[1] }}>
            <Row label="Subtotal" value={formatINR(subtotal)} />
            <Row label="Discount" value={`- ${formatINR(shownDiscount)}`} />
            <Row label="Total" value={formatINR(total)} bold />
          </Card>

          {error || apiError ? (
            <Text variant="caption" color={colors.destructive} accessibilityRole="alert">
              {error ?? apiError}
            </Text>
          ) : null}
          <Button
            title="Save & send on WhatsApp"
            size="lg"
            loading={mutation.isPending}
            onPress={() => submit(true)}
            fullWidth
          />
          <Button
            title={existing ? 'Save draft' : 'Create draft'}
            variant="outline"
            size="lg"
            loading={mutation.isPending}
            onPress={() => submit(false)}
            fullWidth
          />
          <Button title="Preview" variant="ghost" onPress={() => setPreviewOpen(true)} fullWidth />
          {canDeleteDraft ? (
            <Button
              title="Delete draft"
              variant="ghost"
              loading={delMut.isPending}
              onPress={confirmDeleteDraft}
              fullWidth
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <ProposalPreview
        visible={previewOpen}
        onClose={() => setPreviewOpen(false)}
        data={{
          number: existing?.number ?? null,
          title: title.trim(),
          customerName,
          customerPhone: customerPhone ? formatPhone(customerPhone) : null,
          city: customerCity,
          siteAddress: siteAddress.trim() || null,
          items: parsedItems,
          discount: shownDiscount,
          notes: notes.trim() || null,
          terms: terms.trim() || null,
          validUntil: previewValidIso && previewValidIso !== 'invalid' ? previewValidIso : null,
        }}
      />
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space[1] }}>
      <Text variant="caption" muted>
        {label}
      </Text>
      {children}
    </View>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text variant={bold ? 'section' : undefined} muted={!bold}>
        {label}
      </Text>
      <Text variant={bold ? 'section' : undefined} style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: hit,
    paddingHorizontal: space[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.input,
    fontFamily: font.regular,
    fontSize: 16,
    color: colors.foreground,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
    marginTop: 4,
  },
  chip: {
    minHeight: 34,
    paddingHorizontal: space[3],
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.pageSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.tealStrong,
    borderColor: colors.tealStrong,
  },
  orderBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.pageSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
