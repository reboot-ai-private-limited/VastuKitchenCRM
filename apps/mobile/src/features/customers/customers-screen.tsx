import type React from 'react';
import { useState } from 'react';
import { FlatList, Linking, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addCustomerBodySchema, type CustomerDto } from '@vastu/contracts';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, font, radius, space } from '@/constants/theme';
import { ApiError, NetworkError } from '@/lib/api/client';
import { formatPhone, timeAgo } from '@/lib/format';
import { useAddCustomer, useCustomersList } from './use-customers';

function CustomerCard({ customer, index }: { customer: CustomerDto; index: number }) {
  const router = useRouter();
  const digits = customer.phone.replace(/\D/g, '').slice(-10);

  return (
    <Reveal index={index}>
      <PressableScale
        onPress={() =>
          router.push({ pathname: '/customers/[id]', params: { id: customer.id } } as Href)
        }
        scaleTo={0.98}
      >
        <Card style={{ gap: space[2] }}>
          <View style={styles.topRow}>
            <Avatar name={customer.name} size={40} accent={customer.activeProjects > 0} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="section" numberOfLines={1}>
                {customer.name}
              </Text>
              <Text variant="caption" muted style={{ fontVariant: ['tabular-nums'] }}>
                {formatPhone(customer.phone)}
                {customer.city ? `  ·  ${customer.city}` : ''}
              </Text>
            </View>
            <IconButton
              icon="phone"
              label={`Call ${customer.name}`}
              onPress={() => void Linking.openURL(`tel:${digits}`)}
            />
            <IconButton
              icon="message-circle"
              label={`WhatsApp ${customer.name}`}
              onPress={() => void Linking.openURL(`https://wa.me/91${digits}`)}
            />
          </View>
          <View style={styles.metaRow}>
            <Badge
              label={`${customer.projectsCount} project${customer.projectsCount === 1 ? '' : 's'}`}
              t={customer.activeProjects > 0 ? 'accent' : 'neutral'}
            />
            {customer.startedAgain ? <Badge label="New project enquiry" t="info" /> : null}
            <Text variant="caption" muted style={{ marginLeft: 'auto' }}>
              Active {timeAgo(customer.lastActivityAt)}
            </Text>
          </View>
        </Card>
      </PressableScale>
    </Reveal>
  );
}

export function CustomersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const q = useCustomersList(search.trim());
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

  const header = (
    <View style={{ gap: space[3], paddingBottom: space[2] }}>
      <View style={styles.headerRow}>
        <Text variant="title">Customers</Text>
        <Button title="+ Add" size="sm" onPress={() => setAddOpen(true)} />
      </View>
      <View style={styles.search}>
        <Feather name="search" size={18} color={colors.mutedForeground} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search customer or phone"
          placeholderTextColor={colors.placeholder}
          returnKeyType="search"
          style={styles.searchInput}
        />
      </View>
    </View>
  );

  let empty: React.ReactElement | undefined;
  if (q.isPending) {
    empty = (
      <View style={{ gap: space[3] }}>
        {[0, 1, 2].map((i) => (
          <Card key={i} style={{ gap: space[2] }}>
            <Skeleton height={18} width="55%" />
            <Skeleton width="40%" />
          </Card>
        ))}
      </View>
    );
  } else if (q.isError) {
    empty = (
      <View style={{ alignItems: 'center', gap: space[3], paddingVertical: space[8] }}>
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
    <>
      <FlatList
        style={styles.root}
        contentContainerStyle={{
          paddingTop: insets.top + space[4],
          paddingHorizontal: space[4],
          paddingBottom: insets.bottom + space[8],
          gap: space[3],
        }}
        data={q.data ?? []}
        keyExtractor={(c) => c.id}
        renderItem={({ item, index }) => <CustomerCard customer={item} index={index} />}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={q.isFetchingNextPage ? <Skeleton height={80} /> : undefined}
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
              placeholder="e.g. Rajesh Sharma"
              placeholderTextColor={colors.placeholder}
              style={styles.fieldInput}
            />
          </View>
          <View style={{ gap: space[1] }}>
            <Text variant="caption" muted>
              Mobile number (+91)
            </Text>
            <TextInput
              value={phone}
              onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit mobile number"
              placeholderTextColor={colors.placeholder}
              keyboardType="number-pad"
              style={styles.fieldInput}
            />
          </View>
          <View style={{ gap: space[1] }}>
            <Text variant="caption" muted>
              City (optional)
            </Text>
            <TextInput
              value={city}
              onChangeText={setCity}
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
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[2],
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
  },
  searchInput: { flex: 1, fontFamily: font.regular, fontSize: 16, color: colors.foreground },
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
});
