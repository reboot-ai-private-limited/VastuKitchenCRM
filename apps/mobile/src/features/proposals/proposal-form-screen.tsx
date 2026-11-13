import { useState } from 'react';
import { ProposalPreview } from './proposal-preview';
import type React from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
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
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { RoleGate } from '@/components/ui/role-gate';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, font, hit, radius, space } from '@/constants/theme';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { NetworkError } from '@/lib/api/client';
import { listLeads } from '@/lib/api/endpoints/leads';
import { formatINR } from '@/lib/format';
import { useCreateProposal, useProposalDetail, useUpdateProposal } from './use-proposals';

type ItemForm = { title: string; description: string; quantity: string; unitPrice: string };
const blankItem = (): ItemForm => ({ title: '', description: '', quantity: '1', unitPrice: '' });
const DEFAULT_VALID_DAYS = 15;
const DAY_MS = 86_400_000;

const inDays = (n: number) => new Date(Date.now() + n * DAY_MS).toISOString();
const daysUntil = (iso: string) =>
  Math.min(365, Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / DAY_MS)));

/** Create (?leadId, or pick a lead) or edit a DRAFT (/proposals/edit/[id]). Items, discount and validity only. */
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
            <Card style={{ gap: 2 }}>
              <Text variant="label">{l.name}</Text>
              <Text variant="caption" muted>
                {l.phone}
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
  const create = useCreateProposal();
  const update = useUpdateProposal(existing?.id ?? '');
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
  const [days, setDays] = useState(
    existing?.validUntil
      ? String(daysUntil(existing.validUntil))
      : String(DEFAULT_VALID_DAYS),
  );
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const setItem = (i: number, patch: Partial<ItemForm>) =>
    setItems((cur) => cur.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

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

  const submit = () => {
    setError(null);
    const daysN = Number(days);
    if (!Number.isInteger(daysN) || daysN < 1 || daysN > 365) {
      setError('Validity must be 1 to 365 days.');
      return;
    }
    if (!Number.isFinite(discountN) || discountN > subtotal) {
      setError('Discount cannot be more than the subtotal.');
      return;
    }
    const validUntil = inDays(daysN);
    const common = { title: title.trim(), items: parsedItems, discount: discountN, validUntil };
    const done = (p: ProposalDto) => router.replace({ pathname: '/proposals/[id]', params: { id: p.id } } as Href);

    if (existing) {
      const r = updateProposalBodySchema.safeParse({
        ...common,
        siteAddress: siteAddress.trim() || null,
        notes: notes.trim() || null,
      });
      if (!r.success) {
        setError(r.error.issues[0]?.message ?? 'Check the form.');
        return;
      }
      update.mutate(r.data, { onSuccess: done });
    } else {
      const r = createProposalBodySchema.safeParse({
        leadId,
        ...common,
        templateKey: DEFAULT_PROPOSAL_TEMPLATE_KEY,
        ...(siteAddress.trim() ? { siteAddress: siteAddress.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      if (!r.success) {
        setError(r.error.issues[0]?.message ?? 'Check the form.');
        return;
      }
      create.mutate(r.data, { onSuccess: done });
    }
  };

  const mutation = existing ? update : create;
  const apiError = mutation.error
    ? mutation.error instanceof NetworkError
      ? 'Connection lost. Check your internet and try again.'
      : mutation.error.message
    : null;

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
          {items.map((it, i) => (
            <Card key={i} style={{ gap: space[2] }}>
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
          ))}
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
          <Field label="Valid for (days)">
            <TextInput
              value={days}
              onChangeText={(v) => setDays(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              style={styles.input}
              accessibilityLabel="Validity in days"
            />
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
          <Button title="Preview" variant="outline" size="lg" onPress={() => setPreviewOpen(true)} fullWidth />
          <Button
            title={existing ? 'Save changes' : 'Create draft'}
            size="lg"
            loading={mutation.isPending}
            onPress={submit}
            fullWidth
          />
        </ScrollView>
      </KeyboardAvoidingView>
      <ProposalPreview
        visible={previewOpen}
        onClose={() => setPreviewOpen(false)}
        data={{
          number: existing?.number ?? null,
          title: title.trim(),
          customerName: existing?.customer.name ?? null,
          customerPhone: existing?.customer.phone ?? null,
          city: existing?.customer.city ?? null,
          siteAddress: siteAddress.trim() || null,
          items: parsedItems,
          discount: shownDiscount,
          notes: notes.trim() || null,
          terms: existing?.terms ?? null,
          validUntil: Number.isInteger(Number(days)) && Number(days) > 0 ? inDays(Number(days)) : null,
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
});
