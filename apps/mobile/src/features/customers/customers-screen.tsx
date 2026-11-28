import type React from 'react';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addCustomerBodySchema, type CustomerDto } from '@vastu/contracts';
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
import { useAddCustomer, useCustomersList } from './use-customers';

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
          label={`${customer.projectsCount} project${customer.projectsCount === 1 ? '' : 's'}`}
          t={customer.activeProjects > 0 ? 'accent' : 'neutral'}
        />
        {customer.startedAgain ? <Badge label="New project enquiry" t="info" /> : null}
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

  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const q = useCustomersList(debouncedSearch);
  const addMutation = useAddCustomer();

  const closeAdd = () => {
    setAddOpen(false);
    setFormError(null);
  };

  const handleAdd = () => {
    const parsed = addCustomerBodySchema.safeParse({
      name,
      phone,
      city: city.trim() || undefined,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Check customer details');
      return;
    }
    setFormError(null);
    addMutation.mutate(parsed.data, {
      onSuccess: (created) => {
        setName('');
        setPhone('');
        setCity('');
        setAddOpen(false);
        router.push({ pathname: '/customers/[id]', params: { id: created.id } } as Href);
      },
      onError: (err) => {
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
        <View style={styles.headerRow}>
          <Text variant="title" color={colors.inkDeep}>
            Customers
          </Text>
          <Button title="+ Add" size="sm" onPress={() => setAddOpen(true)} />
        </View>
        <View style={styles.search}>
          <Feather name="search" size={17} color={colors.inkMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search customer or phone"
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
            <Text variant="caption" color={colors.destructive}>
              {formError}
            </Text>
          ) : null}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
