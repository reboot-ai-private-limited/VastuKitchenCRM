import type React from 'react';
import { useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  addCustomerBodySchema,
  MAX_CUSTOMER_IMPORT_ROWS,
  type CustomerDto,
  type ImportCustomersResultDto,
} from '@vastu/contracts';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { PhoneField } from '@/components/ui/phone-field';
import { PressableScale } from '@/components/ui/pressable-scale';
import { RoleGate } from '@/components/ui/role-gate';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, font, hit, radius, space } from '@/constants/theme';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { ApiError, NetworkError } from '@/lib/api/client';
import { formatPhone, timeAgo } from '@/lib/format';
import { openLink, telUrl, whatsappUrlFor } from '@/lib/phone';
import { useAddCustomer, useCustomersList, useImportCustomers } from './use-customers';

type CsvRow = { name: string; phone: string; city?: string };

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseCustomersCsv(text: string): { rows: CsvRow[]; error?: string } {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return { rows: [], error: 'CSV must have a header row and at least one customer.' };
  const headers = parseCsvLine(lines[0] ?? '').map((h) => h.toLowerCase());
  const nameIdx = headers.findIndex((h) => h === 'name' || h === 'full name' || h === 'customer');
  const phoneIdx = headers.findIndex((h) => h === 'phone' || h === 'mobile' || h === 'phone number');
  const cityIdx = headers.findIndex((h) => h === 'city' || h === 'location');
  if (nameIdx < 0 || phoneIdx < 0) {
    return { rows: [], error: 'CSV must include "name" and "phone" columns (optional: "city").' };
  }
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i] ?? '');
    const name = cols[nameIdx] ?? '';
    const phone = cols[phoneIdx] ?? '';
    const city = cityIdx >= 0 ? cols[cityIdx] || undefined : undefined;
    if (name || phone) rows.push({ name, phone, ...(city ? { city } : {}) });
  }
  if (rows.length === 0) return { rows: [], error: 'No customer rows found in the CSV.' };
  return { rows };
}

function CustomerRow({ customer }: { customer: CustomerDto }) {
  const router = useRouter();

  return (
    <PressableScale
      onPress={() =>
        router.push({ pathname: '/customers/[id]', params: { id: customer.id } } as Href)
      }
      scaleTo={0.99}
      accessibilityRole="button"
      accessibilityLabel={`${customer.name}, ${formatPhone(customer.phone)}`}
      style={styles.flatRow}
    >
      <View style={styles.topRow}>
        <Avatar name={customer.name} size={36} accent={customer.activeProjects > 0} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text color={colors.inkDeep} numberOfLines={1} style={styles.name}>
            {customer.name}
          </Text>
          <Text variant="caption" color={colors.inkMuted} numberOfLines={1} style={styles.tabular}>
            {formatPhone(customer.phone)}
            {customer.city ? `  ·  ${customer.city}` : ''}
          </Text>
        </View>
        <IconButton
          icon="phone"
          label={`Call ${customer.name}`}
          onPress={() => void openLink(telUrl(customer.phone))}
        />
        <IconButton
          icon="message-circle"
          label={`WhatsApp ${customer.name}`}
          onPress={() => void openLink(whatsappUrlFor(customer.phone))}
        />
      </View>
      <View style={styles.metaRow}>
        <Badge
          label={
            customer.projectsCount === 0
              ? 'No project yet'
              : customer.activeProjects > 0
                ? `${customer.projectsCount} project${customer.projectsCount === 1 ? '' : 's'} · ${customer.activeProjects} active`
                : `${customer.projectsCount} project${customer.projectsCount === 1 ? '' : 's'}`
          }
          t={customer.activeProjects > 0 ? 'accent' : 'neutral'}
        />
        {customer.startedAgain ? <Badge label="New project enquiry" t="info" /> : null}
        {customer.owner ? (
          <Text variant="caption" color={colors.inkMuted} numberOfLines={1}>
            {customer.owner.name}
          </Text>
        ) : null}
        <Text variant="caption" color={colors.inkMuted} style={{ marginLeft: 'auto' }}>
          Active {timeAgo(customer.lastActivityAt)}
        </Text>
      </View>
    </PressableScale>
  );
}

export function CustomersScreen() {
  return (
    <RoleGate roles={['ADMIN', 'SALES', 'OFFICE']}>
      <CustomersList />
    </RoleGate>
  );
}

function CustomersList() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [csvName, setCsvName] = useState<string | null>(null);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportCustomersResultDto | null>(null);
  const [importing, setImporting] = useState(false);

  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const q = useCustomersList(debouncedSearch);
  const addMutation = useAddCustomer();
  const importMutation = useImportCustomers();

  const closeAdd = () => {
    setAddOpen(false);
    setFormError(null);
    setDuplicateId(null);
  };

  const closeImport = () => {
    setImportOpen(false);
    setCsvName(null);
    setCsvRows([]);
    setCsvError(null);
    setImportResult(null);
  };

  const pickCsv = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets[0]) return;
      const asset = res.assets[0];
      const text = await fetch(asset.uri).then((r) => r.text());
      const parsed = parseCustomersCsv(text);
      setCsvName(asset.name);
      setImportResult(null);
      if (parsed.error) {
        setCsvRows([]);
        setCsvError(parsed.error);
      } else {
        setCsvError(null);
        setCsvRows(parsed.rows);
      }
    } catch {
      Alert.alert('Could not read file', 'Please pick a valid CSV file.');
    }
  };

  const runImport = async () => {
    if (csvRows.length === 0) return;
    setImporting(true);
    setCsvError(null);
    const agg: ImportCustomersResultDto = { created: 0, linked: 0, existing: [], invalid: [] };
    try {
      for (let i = 0; i < csvRows.length; i += MAX_CUSTOMER_IMPORT_ROWS) {
        const batch = csvRows.slice(i, i + MAX_CUSTOMER_IMPORT_ROWS);
        const res = await importMutation.mutateAsync({ rows: batch });
        agg.created += res.created;
        agg.linked += res.linked;
        agg.existing.push(...res.existing.map((e) => ({ ...e, row: e.row + i })));
        agg.invalid.push(...res.invalid.map((e) => ({ ...e, row: e.row + i })));
      }
      setImportResult(agg);
    } catch (err) {
      setCsvError(err instanceof ApiError ? err.message : 'Import failed. Try again.');
    } finally {
      setImporting(false);
    }
  };

  const handleAdd = () => {
    const parsed = addCustomerBodySchema.safeParse({
      name,
      phone,
      city: city.trim() || undefined,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Check customer details');
      setDuplicateId(null);
      return;
    }
    setFormError(null);
    setDuplicateId(null);
    addMutation.mutate(parsed.data, {
      onSuccess: (created) => {
        setName('');
        setPhone('');
        setCity('');
        setAddOpen(false);
        router.push({ pathname: '/customers/[id]', params: { id: created.id } } as Href);
      },
      onError: (err) => {
        if (err instanceof ApiError && err.status === 409) {
          const details = err.data as { existingCustomerId?: string } | undefined;
          setDuplicateId(details?.existingCustomerId ?? null);
        }
        setFormError(
          err instanceof NetworkError
            ? 'Connection lost. Check your internet and try again.'
            : err instanceof ApiError
              ? err.message
              : 'Could not add customer',
        );
      },
    });
  };

  let empty: React.ReactElement | undefined;
  if (q.isPending) {
    empty = (
      <View>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.flatRow, i > 0 && styles.divider]}>
            <Skeleton height={18} width="55%" />
            <Skeleton height={14} width="40%" />
          </View>
        ))}
      </View>
    );
  } else if (q.isError) {
    empty = (
      <View style={styles.errorWrap}>
        <Text muted style={{ textAlign: 'center' }}>
          {q.error instanceof NetworkError
            ? 'Connection lost. Check your internet and try again.'
            : q.error.message}
        </Text>
        <Button title="Retry" variant="outline" onPress={() => void q.refetch()} />
      </View>
    );
  } else {
    empty = <EmptyState icon="users" message="No customers found." />;
  }

  return (
    <View style={styles.root}>
      <View style={[styles.stickyHeader, { paddingTop: insets.top + space[4] }]}>
        <Text variant="title" color={colors.inkDeep} style={styles.heading}>
          Customers
        </Text>
        <View style={styles.searchRow}>
          <View style={styles.search}>
            <Feather name="search" size={17} color={colors.inkMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name, phone or city"
              placeholderTextColor={colors.placeholder}
              returnKeyType="search"
              accessibilityLabel="Search customers"
              style={styles.searchInput}
            />
            {search.length > 0 ? (
              <PressableScale
                onPress={() => setSearch('')}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                hitSlop={10}
              >
                <Feather name="x" size={16} color={colors.inkMuted} />
              </PressableScale>
            ) : null}
          </View>
          <PressableScale
            onPress={() => setImportOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Import customers CSV"
            hitSlop={4}
            style={styles.importBtn}
          >
            <Feather name="upload" size={16} color={colors.inkDeep} />
          </PressableScale>
          <PressableScale
            onPress={() => setAddOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Add customer"
            hitSlop={4}
            style={styles.addBtn}
          >
            <Feather name="plus" size={16} color={colors.primaryForeground} />
            <Text variant="caption" color={colors.primaryForeground} style={{ fontFamily: font.semibold }}>
              Add
            </Text>
          </PressableScale>
        </View>
      </View>

      <FlatList
        data={q.data ?? []}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <CustomerRow customer={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={empty}
        ListFooterComponent={
          q.isFetchingNextPage ? (
            <View style={{ padding: space[4] }}>
              <Skeleton height={56} />
            </View>
          ) : undefined
        }
        contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + space[8] }}
        onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
        onEndReachedThreshold={0.5}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching && !q.isFetchingNextPage}
            onRefresh={() => void q.refetch()}
            tintColor={colors.primary}
          />
        }
      />

      <BottomSheet
        visible={addOpen}
        onClose={closeAdd}
        title="Add customer"
        subtitle="Creates a customer account and links their phone record"
        footer={
          <Button
            title="Save customer"
            size="lg"
            loading={addMutation.isPending}
            onPress={handleAdd}
            fullWidth
          />
        }
      >
        <View style={{ gap: space[3] }}>
          <View style={{ gap: space[1] }}>
            <Text variant="caption" muted>
              Full name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              accessibilityLabel="Full name"
              placeholder="e.g. Rajesh Sharma"
              placeholderTextColor={colors.placeholder}
              style={styles.fieldInput}
            />
          </View>
          <View style={{ gap: space[1] }}>
            <Text variant="caption" muted>
              Mobile number
            </Text>
            <PhoneField value={phone} onChangeText={setPhone} accessibilityLabel="Mobile number" />
          </View>
          <View style={{ gap: space[1] }}>
            <Text variant="caption" muted>
              City (optional)
            </Text>
            <TextInput
              value={city}
              onChangeText={setCity}
              accessibilityLabel="City"
              placeholder="e.g. Jaipur"
              placeholderTextColor={colors.placeholder}
              style={styles.fieldInput}
            />
          </View>
          {formError ? (
            <View style={{ gap: space[2] }}>
              <Text variant="caption" color={colors.destructive}>
                {formError}
              </Text>
              {duplicateId ? (
                <Button
                  title="Open existing customer"
                  variant="outline"
                  size="sm"
                  onPress={() => {
                    const target = duplicateId;
                    closeAdd();
                    router.push({ pathname: '/customers/[id]', params: { id: target } } as Href);
                  }}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      </BottomSheet>

      <BottomSheet
        visible={importOpen}
        onClose={closeImport}
        title="Import customers"
        subtitle="Upload a CSV with name, phone, and optional city columns."
        footer={
          importResult ? (
            <Button title="Done" onPress={closeImport} fullWidth />
          ) : (
            <Button
              title={
                csvRows.length > 0
                  ? `Import ${csvRows.length} customer${csvRows.length === 1 ? '' : 's'}`
                  : 'Choose CSV file'
              }
              loading={importing}
              onPress={() => void (csvRows.length > 0 ? runImport() : pickCsv())}
              fullWidth
            />
          )
        }
      >
        <View style={{ gap: space[3] }}>
          {importResult ? (
            <View style={{ gap: space[2] }}>
              <Text variant="label" color={colors.inkDeep}>
                Import complete
              </Text>
              <Text variant="caption" color={colors.inkMuted} style={styles.tabular}>
                Added: {importResult.created} · Linked to lead: {importResult.linked} · Existing:{' '}
                {importResult.existing.length} · Invalid: {importResult.invalid.length}
              </Text>
              {importResult.existing.slice(0, 5).map((e) => (
                <PressableScale
                  key={`${e.row}-${e.customerId}`}
                  onPress={() => {
                    closeImport();
                    router.push({ pathname: '/customers/[id]', params: { id: e.customerId } } as Href);
                  }}
                  style={styles.importRow}
                >
                  <Text variant="caption" color={colors.primary} style={{ flex: 1 }}>
                    Row {e.row}: {e.phone} (already exists)
                  </Text>
                  <Feather name="chevron-right" size={14} color={colors.primary} />
                </PressableScale>
              ))}
            </View>
          ) : (
            <>
              <Button
                title={csvName ? `Selected: ${csvName}` : 'Pick CSV file'}
                variant="outline"
                onPress={() => void pickCsv()}
                fullWidth
              />
              {csvRows.length > 0 ? (
                <Text variant="caption" color={colors.inkMuted} style={styles.tabular}>
                  Ready to import {csvRows.length} row{csvRows.length === 1 ? '' : 's'}.
                </Text>
              ) : null}
              {csvError ? (
                <Text variant="caption" color={colors.destructive}>
                  {csvError}
                </Text>
              ) : null}
            </>
          )}
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.card },
  stickyHeader: {
    backgroundColor: colors.card,
    paddingHorizontal: space[4],
    paddingBottom: space[3],
    gap: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  heading: {
    textAlign: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  importBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.pageSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingVertical: space[2],
  },
  addBtn: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space[3],
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  flatRow: {
    backgroundColor: colors.card,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: space[2],
    minHeight: hit,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  name: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: font.semibold,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[2],
    paddingLeft: 44,
  },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    height: 44,
    paddingHorizontal: space[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.pageSoft,
  },
  searchInput: { flex: 1, fontFamily: font.regular, fontSize: 15, color: colors.foreground },
  fieldInput: {
    height: 48,
    paddingHorizontal: space[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.background,
    fontFamily: font.regular,
    fontSize: 16,
    color: colors.foreground,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: space[4],
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  errorWrap: {
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[8],
    paddingHorizontal: space[4],
  },
});
