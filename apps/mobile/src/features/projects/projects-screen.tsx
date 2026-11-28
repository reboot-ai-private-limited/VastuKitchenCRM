import type React from 'react';
import { useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CustomerDto, DesignStage, ProjectDto, ProjectStage } from '@vastu/contracts';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, font, hit, radius, space } from '@/constants/theme';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { ApiError, NetworkError } from '@/lib/api/client';
import { listCustomers } from '@/lib/api/endpoints/customers';
import { listUsers } from '@/lib/api/endpoints/users';
import { useSession } from '@/lib/auth/session';
import { formatDate, formatINR } from '@/lib/format';
import { DESIGN_LABEL, DESIGN_SUB_LABEL, STAGE_LABEL, STAGE_ORDER, STAGE_TONE } from './project-meta';
import { SlidingSwitch } from './sliding-switch';
import { useCreateProject, useProjectsList } from './use-projects';

const DESIGN_ORDER: DesignStage[] = ['NOT_STARTED', 'IN_DESIGN', 'SHARED', 'APPROVED'];

function ProjectRow({ project, isDuplicateName }: { project: ProjectDto; isDuplicateName: boolean }) {
  const router = useRouter();
  const closed = project.stage === 'CLOSED';
  const refCode = `#${project.id.slice(-4).toUpperCase()}`;
  const detailParts: string[] = [];
  if (project.siteAddress) detailParts.push(project.siteAddress);
  if (project.designer) detailParts.push(project.designer.name);
  if (isDuplicateName || detailParts.length === 0) {
    detailParts.push(`Created ${formatDate(project.createdAt)}`);
  }

  return (
    <Reveal>
      <PressableScale onPress={() => router.push({ pathname: '/projects/[id]', params: { id: project.id } })}>
        <View style={[styles.projectCard, closed && { opacity: 0.65 }]}>
          <View style={styles.row}>
            <Text variant="section" color={colors.inkDeep} numberOfLines={1} style={{ flex: 1 }}>
              {project.name}
            </Text>
            <Text variant="caption" color={colors.inkMuted} style={styles.refCode}>
              {refCode}
            </Text>
            <Feather name="chevron-right" size={18} color={colors.inkMuted} />
          </View>

          <View style={styles.customerRow}>
            <Text color={colors.inkMuted} numberOfLines={1} style={{ flex: 1, fontSize: 14 }}>
              {project.customer.name}
            </Text>
            {project.value != null && !closed ? (
              <Text color={colors.inkDeep} style={styles.valueText}>
                {formatINR(project.value)}
              </Text>
            ) : null}
          </View>

          <View style={styles.metaRow}>
            <Feather
              name={project.siteAddress ? 'map-pin' : 'calendar'}
              size={12}
              color={colors.inkMuted}
            />
            <Text variant="caption" color={colors.inkMuted} numberOfLines={1} style={{ flex: 1 }}>
              {detailParts.join('  ·  ')}
            </Text>
          </View>

          <View style={styles.stageRow}>
            <Badge label={STAGE_LABEL[project.stage]} t={STAGE_TONE[project.stage]} />
            {project.stage === 'DESIGN' ? (
              <Text variant="caption" color={colors.inkMuted} numberOfLines={1}>
                {DESIGN_SUB_LABEL[project.designStage]}
              </Text>
            ) : null}
          </View>
        </View>
      </PressableScale>
    </Reveal>
  );
}

export function ProjectsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useSession();
  const isAdmin = user?.role === 'ADMIN';
  const isStaff = !!user && user.role !== 'CUSTOMER';

  const [search, setSearch] = useState('');
  const [stage, setStage] = useState<ProjectStage | undefined>();
  const [designStage, setDesignStage] = useState<DesignStage | undefined>();
  const [designerId, setDesignerId] = useState<string | undefined>();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const [customerSearch, setCustomerSearch] = useState('');
  const debouncedCustomer = useDebouncedValue(customerSearch.trim(), 250);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDto | null>(null);
  const [projectName, setProjectName] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [valueInput, setValueInput] = useState('');

  const debounced = useDebouncedValue(search.trim(), 300);
  const q = useProjectsList(debounced, stage, designStage, designerId);
  const createMut = useCreateProject();

  const designersQ = useQuery({
    queryKey: ['users', 'designers'],
    queryFn: ({ signal }) => listUsers({ role: 'DESIGNER', pageSize: 100 }, signal),
    enabled: isStaff && (filtersOpen || !!designerId),
    staleTime: 60_000,
  });
  const designers = designersQ.data?.items ?? [];

  const customersQ = useQuery({
    queryKey: ['customers', 'picker', debouncedCustomer],
    queryFn: ({ signal }) => listCustomers(1, debouncedCustomer || undefined, signal),
    enabled: isAdmin && createOpen,
    staleTime: 30_000,
  });
  const customers = customersQ.data?.items ?? [];

  const activeFilterCount = (designStage ? 1 : 0) + (designerId ? 1 : 0);
  const selectedDesignerName = designers.find((d) => d.id === designerId)?.name;

  const resetCreate = () => {
    setSelectedCustomer(null);
    setCustomerSearch('');
    setProjectName('');
    setSiteAddress('');
    setValueInput('');
  };

  const submitCreate = () => {
    if (!selectedCustomer) {
      Alert.alert('Select a customer', 'Pick a customer before creating the project.');
      return;
    }
    const name = projectName.trim();
    if (!name) {
      Alert.alert('Project name required', 'Enter a name for this project.');
      return;
    }
    const cleanVal = valueInput.replace(/[^0-9]/g, '');
    const value = cleanVal ? Number.parseInt(cleanVal, 10) : undefined;
    createMut.mutate(
      {
        customerId: selectedCustomer.id,
        name,
        ...(siteAddress.trim() ? { siteAddress: siteAddress.trim() } : {}),
        ...(value !== undefined && !Number.isNaN(value) ? { value } : {}),
      },
      {
        onSuccess: (created) => {
          setCreateOpen(false);
          resetCreate();
          router.push({ pathname: '/projects/[id]', params: { id: created.id } });
        },
        onError: (e) =>
          Alert.alert(
            'Could not create project',
            e instanceof ApiError ? e.message : 'Something went wrong. Try again.',
          ),
      },
    );
  };

  const all = q.data ?? [];
  const closedCount = all.filter((p) => p.stage === 'CLOSED').length;
  const visible = stage === 'CLOSED' ? all : all.filter((p) => p.stage !== 'CLOSED');
  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of visible) {
      const k = p.name.trim().toLowerCase();
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const dups = new Set<string>();
    for (const [k, n] of counts) {
      if (n > 1) dups.add(k);
    }
    return dups;
  }, [visible]);

  let body: React.ReactElement | undefined;
  if (q.isPending) {
    body = (
      <View style={{ gap: 11 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.projectCard}>
            <Skeleton height={18} width="60%" />
            <Skeleton width="45%" />
            <Skeleton height={20} width={100} />
          </View>
        ))}
      </View>
    );
  } else if (q.isError) {
    body = (
      <View style={{ alignItems: 'center', gap: space[3], paddingVertical: space[8] }}>
        <Text muted style={{ textAlign: 'center' }}>
          {q.error instanceof NetworkError
            ? 'Connection lost. Check your internet and try again.'
            : q.error.message}
        </Text>
        <Button title="Retry" variant="outline" onPress={() => void q.refetch()} />
      </View>
    );
  } else if (visible.length === 0) {
    body = (
      <EmptyState
        icon="layers"
        message={
          debounced || activeFilterCount > 0
            ? 'No projects match your filters'
            : stage === 'CLOSED'
              ? 'No closed projects.'
              : closedCount > 0 && stage === undefined
                ? 'No active projects right now. Check the Closed tab.'
                : 'No projects found.'
        }
      />
    );
  }

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.stickyHeader,
          { paddingTop: insets.top + space[4] },
        ]}
      >
        <Text variant="title" color={colors.inkDeep} style={{ textAlign: 'center' }}>
          Projects
        </Text>
        <View style={styles.searchRow}>
          <View style={styles.search}>
            <Feather name="search" size={17} color={colors.inkMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search project or customer"
              placeholderTextColor={colors.placeholder}
              returnKeyType="search"
              style={styles.searchInput}
            />
          </View>
          <PressableScale
            onPress={() => setFiltersOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Filter projects"
            style={[styles.iconBtn, activeFilterCount > 0 && styles.iconBtnActive]}
          >
            <Feather
              name="sliders"
              size={17}
              color={activeFilterCount > 0 ? colors.tealStrong : colors.inkDeep}
            />
            {activeFilterCount > 0 ? (
              <View style={styles.filterDot}>
                <Text variant="caption" color={colors.primaryForeground} style={styles.filterDotText}>
                  {activeFilterCount}
                </Text>
              </View>
            ) : null}
          </PressableScale>
          {isAdmin ? (
            <PressableScale
              onPress={() => setCreateOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="New project"
              style={styles.addBtn}
            >
              <Feather name="plus" size={16} color={colors.primaryForeground} />
              <Text variant="label" color={colors.primaryForeground} style={{ fontFamily: font.semibold }}>
                New
              </Text>
            </PressableScale>
          ) : null}
        </View>
        <SlidingSwitch
          options={[
            { value: 'ACTIVE' as const, label: 'Active' },
            ...STAGE_ORDER.map((s) => ({
              value: s,
              label: s === 'CLOSED' && closedCount > 0 ? `${STAGE_LABEL[s]} (${closedCount})` : STAGE_LABEL[s],
            })),
          ]}
          value={stage ?? 'ACTIVE'}
          onChange={(next) => setStage(next === 'ACTIVE' ? undefined : next)}
        />
        {activeFilterCount > 0 ? (
          <View style={styles.activeFiltersRow}>
            {designStage ? (
              <PressableScale onPress={() => setDesignStage(undefined)} style={styles.activeChip}>
                <Text variant="caption" color={colors.tealStrong} style={{ fontFamily: font.medium }}>
                  Design: {DESIGN_LABEL[designStage]}
                </Text>
                <Feather name="x" size={13} color={colors.tealStrong} />
              </PressableScale>
            ) : null}
            {designerId ? (
              <PressableScale onPress={() => setDesignerId(undefined)} style={styles.activeChip}>
                <Text variant="caption" color={colors.tealStrong} style={{ fontFamily: font.medium }}>
                  Designer: {selectedDesignerName ?? 'Selected'}
                </Text>
                <Feather name="x" size={13} color={colors.tealStrong} />
              </PressableScale>
            ) : null}
          </View>
        ) : null}
      </View>

      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: space[3],
          paddingHorizontal: space[4],
          paddingBottom: space[8],
          gap: 11,
        }}
        data={visible}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <ProjectRow
            project={item}
            isDuplicateName={duplicateNames.has(item.name.trim().toLowerCase())}
          />
        )}
        ListEmptyComponent={body}
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
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filter projects"
        footer={
          <View style={styles.sheetFooter}>
            <View style={{ flex: 1 }}>
              <Button
                title="Clear"
                variant="outline"
                onPress={() => {
                  setDesignStage(undefined);
                  setDesignerId(undefined);
                }}
                disabled={activeFilterCount === 0}
                fullWidth
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Done" onPress={() => setFiltersOpen(false)} fullWidth />
            </View>
          </View>
        }
      >
        <View style={{ gap: space[4] }}>
          <View style={{ gap: space[2] }}>
            <Text variant="label" color={colors.inkDeep}>
              Design stage
            </Text>
            <View style={styles.chipWrap}>
              <PressableScale
                onPress={() => setDesignStage(undefined)}
                style={[styles.chip, !designStage && styles.chipActive]}
              >
                <Text
                  variant="caption"
                  color={!designStage ? colors.primaryForeground : colors.inkDeep}
                  style={{ fontFamily: !designStage ? font.semibold : font.medium }}
                >
                  All
                </Text>
              </PressableScale>
              {DESIGN_ORDER.map((ds) => {
                const selected = designStage === ds;
                return (
                  <PressableScale
                    key={ds}
                    onPress={() => setDesignStage(selected ? undefined : ds)}
                    style={[styles.chip, selected && styles.chipActive]}
                  >
                    <Text
                      variant="caption"
                      color={selected ? colors.primaryForeground : colors.inkDeep}
                      style={{ fontFamily: selected ? font.semibold : font.medium }}
                    >
                      {DESIGN_LABEL[ds]}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          </View>

          {isStaff ? (
            <View style={{ gap: space[2] }}>
              <Text variant="label" color={colors.inkDeep}>
                Designer
              </Text>
              {designersQ.isPending ? (
                <Skeleton height={36} width="70%" />
              ) : designers.length === 0 ? (
                <Text variant="caption" muted>
                  No designers found.
                </Text>
              ) : (
                <View style={styles.chipWrap}>
                  <PressableScale
                    onPress={() => setDesignerId(undefined)}
                    style={[styles.chip, !designerId && styles.chipActive]}
                  >
                    <Text
                      variant="caption"
                      color={!designerId ? colors.primaryForeground : colors.inkDeep}
                      style={{ fontFamily: !designerId ? font.semibold : font.medium }}
                    >
                      All
                    </Text>
                  </PressableScale>
                  {designers.map((d) => {
                    const selected = designerId === d.id;
                    return (
                      <PressableScale
                        key={d.id}
                        onPress={() => setDesignerId(selected ? undefined : d.id)}
                        style={[styles.chip, selected && styles.chipActive]}
                      >
                        <Text
                          variant="caption"
                          color={selected ? colors.primaryForeground : colors.inkDeep}
                          style={{ fontFamily: selected ? font.semibold : font.medium }}
                        >
                          {d.name}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </View>
              )}
            </View>
          ) : null}
        </View>
      </BottomSheet>

      <BottomSheet
        visible={createOpen}
        onClose={() => {
          setCreateOpen(false);
          resetCreate();
        }}
        title="New project"
        footer={
          <Button
            title="Create project"
            onPress={submitCreate}
            loading={createMut.isPending}
            disabled={!selectedCustomer || !projectName.trim()}
            fullWidth
          />
        }
      >
        <View style={{ gap: space[3] }}>
          <View style={{ gap: space[2] }}>
            <Text variant="label" color={colors.inkDeep}>
              Customer
            </Text>
            {selectedCustomer ? (
              <View style={styles.selectedCustomer}>
                <View style={{ flex: 1 }}>
                  <Text variant="label" color={colors.inkDeep} numberOfLines={1}>
                    {selectedCustomer.name}
                  </Text>
                  <Text variant="caption" color={colors.inkMuted}>
                    {selectedCustomer.phone}
                  </Text>
                </View>
                <PressableScale
                  onPress={() => setSelectedCustomer(null)}
                  accessibilityLabel="Change customer"
                  style={styles.clearBtn}
                >
                  <Text variant="caption" color={colors.tealStrong} style={{ fontFamily: font.semibold }}>
                    Change
                  </Text>
                </PressableScale>
              </View>
            ) : (
              <View style={{ gap: space[2] }}>
                <Input
                  value={customerSearch}
                  onChangeText={setCustomerSearch}
                  placeholder="Search customer by name or phone"
                />
                <View style={styles.pickerList}>
                  {customersQ.isPending ? (
                    <Skeleton height={44} />
                  ) : customers.length === 0 ? (
                    <Text variant="caption" muted style={{ padding: space[3] }}>
                      No matching customers
                    </Text>
                  ) : (
                    <ScrollView style={{ maxHeight: 170 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                      {customers.map((c, idx) => (
                        <PressableScale
                          key={c.id}
                          onPress={() => {
                            setSelectedCustomer(c);
                            if (!projectName.trim()) setProjectName(`${c.name} Kitchen`);
                          }}
                          style={[styles.pickerRow, idx > 0 && styles.pickerDivider]}
                        >
                          <Text variant="label" color={colors.inkDeep} numberOfLines={1}>
                            {c.name}
                          </Text>
                          <Text variant="caption" color={colors.inkMuted}>
                            {c.phone}
                          </Text>
                        </PressableScale>
                      ))}
                    </ScrollView>
                  )}
                </View>
              </View>
            )}
          </View>

          <Input
            label="Project name"
            value={projectName}
            onChangeText={setProjectName}
            placeholder="e.g. Sharma Kitchen"
          />
          <Input
            label="Site address (optional)"
            value={siteAddress}
            onChangeText={setSiteAddress}
            placeholder="Full site address"
          />
          <Input
            label="Project value in ₹ (optional)"
            value={valueInput}
            onChangeText={(t) => setValueInput(t.replace(/[^0-9]/g, ''))}
            placeholder="e.g. 450000"
            keyboardType="number-pad"
          />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageSoft },
  stickyHeader: {
    backgroundColor: colors.pageSoft,
    paddingHorizontal: space[4],
    paddingBottom: space[3],
    gap: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  projectCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 15,
    paddingVertical: space[4],
    paddingHorizontal: space[4],
    gap: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  valueText: {
    fontSize: 14,
    fontFamily: font.semibold,
    fontVariant: ['tabular-nums'],
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingTop: 2 },
  refCode: { fontSize: 11, fontVariant: ['tabular-nums'], letterSpacing: 0.4 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    height: 44,
    paddingHorizontal: space[3],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  searchInput: { flex: 1, fontFamily: font.regular, fontSize: 15, color: colors.inkDeep },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnActive: {
    borderColor: colors.tealStrong,
    backgroundColor: colors.primarySoft,
  },
  filterDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: radius.full,
    backgroundColor: colors.tealStrong,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  filterDotText: {
    fontSize: 10,
    lineHeight: 12,
    fontFamily: font.semibold,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 44,
    paddingHorizontal: space[3],
    borderRadius: 12,
    backgroundColor: colors.tealStrong,
  },
  activeFiltersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space[3],
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.tealStrong,
  },
  sheetFooter: {
    flexDirection: 'row',
    gap: space[2],
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  chip: {
    minHeight: 38,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
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
  selectedCustomer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    padding: space[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.pageSoft,
  },
  clearBtn: {
    minHeight: hit,
    justifyContent: 'center',
    paddingHorizontal: space[2],
  },
  pickerList: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.pageSoft,
    overflow: 'hidden',
  },
  pickerRow: {
    paddingHorizontal: space[3],
    paddingVertical: space[3],
    gap: 2,
  },
  pickerDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
