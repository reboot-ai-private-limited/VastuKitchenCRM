import type React from 'react';
import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ATTENDANCE_TYPES,
  STAFF_ROLES,
  createUserBodySchema,
  setUserPasswordBodySchema,
  type AttendanceType,
  type DesignationDto,
  type StaffRole,
  type UserDto,
} from '@vastu/contracts';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { PhoneField } from '@/components/ui/phone-field';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { RoleGate } from '@/components/ui/role-gate';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { ROLE_LABEL } from '@/constants/roles';
import { colors, font, hit, radius, space } from '@/constants/theme';
import { BottomBar } from '@/features/projects/bottom-bar';
import { SlidingSwitch } from '@/features/projects/sliding-switch';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { ApiError, NetworkError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { addMonths, businessMonth, formatINR, formatMonthLabel, formatPhone } from '@/lib/format';
import { softTick } from '@/lib/haptics';
import { openLink, telUrl, whatsappUrlFor } from '@/lib/phone';
import {
  useCreateDesignation,
  useCreateEmployee,
  useDesignations,
  useSetEmployeePassword,
  useSetUserTarget,
  useTargetsSheet,
  useTeam,
  useUpdateDesignation,
  useUpdateEmployee,
} from './use-team';

const HR_ROLES: StaffRole[] = ['SALES', 'DESIGNER', 'TECHNICIAN', 'OFFICE'];
const ATT_LABEL: Record<AttendanceType, string> = { GPS: 'GPS', BIOMETRIC: 'Biometric' };

type ActiveFilter = 'active' | 'all' | 'inactive';

type SheetState =
  | { kind: 'actions'; member: UserDto }
  | { kind: 'add' }
  | { kind: 'edit'; member: UserDto }
  | { kind: 'password'; member: UserDto }
  | { kind: 'target'; member: UserDto }
  | { kind: 'designations' }
  | { kind: 'rename-designation'; d: DesignationDto }
  | null;

const fail = (title: string) => (e: unknown) =>
  Alert.alert(title, e instanceof ApiError ? e.message : 'Something went wrong. Try again.');

/** Staff directory for Admin & HR. Never displays `fixedSalary` (00-principles-and-scope.md §5). */
function StaffCard({
  member,
  isSelf,
  targetAmount,
  onMenu,
}: {
  member: UserDto;
  isSelf: boolean;
  targetAmount?: number;
  onMenu: () => void;
}) {
  const router = useRouter();
  return (
    <Reveal>
      <Card style={[styles.card, !member.active && { opacity: 0.6 }]}>
        <PressableScale
          onPress={() =>
            router.push({ pathname: '/attendance/[userId]', params: { userId: member.id } } as Href)
          }
          scaleTo={0.99}
          accessibilityLabel={`${member.name}, view attendance`}
          style={styles.cardMain}
        >
          <Avatar name={member.name} size={40} accent={isSelf} />
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text variant="label" numberOfLines={1} style={{ flexShrink: 1 }}>
                {member.name}
                {isSelf ? ' (you)' : ''}
              </Text>
            </View>
            <Text variant="caption" muted numberOfLines={1}>
              {member.designation ?? ROLE_LABEL[member.role]}
              {member.attendanceType ? ` · ${ATT_LABEL[member.attendanceType]}` : ''}
            </Text>
            <Text variant="caption" muted style={{ fontVariant: ['tabular-nums'] }}>
              {formatPhone(member.phone)}
              {targetAmount != null && targetAmount > 0 ? ` · Target ${formatINR(targetAmount)}` : ''}
            </Text>
            <View style={styles.badgeRow}>
              <Badge label={ROLE_LABEL[member.role]} t="neutral" />
              {!member.canLogin ? <Badge label="No login" t="warning" /> : null}
              {!member.active ? <Badge label="Deactivated" t="danger" /> : null}
            </View>
          </View>
        </PressableScale>
        <View style={styles.cardActions}>
          <IconButton
            icon="phone"
            label={`Call ${member.name}`}
            onPress={() => void openLink(telUrl(member.phone))}
          />
          <IconButton
            icon="message-circle"
            label={`WhatsApp ${member.name}`}
            onPress={() => void openLink(whatsappUrlFor(member.phone))}
          />
          <PressableScale
            onPress={onMenu}
            accessibilityRole="button"
            accessibilityLabel={`Actions for ${member.name}`}
            style={styles.moreBtn}
          >
            <Feather name="more-vertical" size={17} color={colors.inkMuted} />
          </PressableScale>
        </View>
      </Card>
    </Reveal>
  );
}

export function TeamScreen() {
  return (
    <RoleGate roles={['ADMIN', 'HR']}>
      <TeamList />
    </RoleGate>
  );
}

function TeamList() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useSession();
  const isAdmin = user?.role === 'ADMIN';
  const allowedRoles: readonly StaffRole[] = isAdmin ? STAFF_ROLES : HR_ROLES;

  const [search, setSearch] = useState('');
  const [role, setRole] = useState<StaffRole | undefined>();
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active');
  const [sheet, setSheet] = useState<SheetState>(null);

  // Employee form state
  const [empName, setEmpName] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [empRole, setEmpRole] = useState<StaffRole>('SALES');
  const [empDesignation, setEmpDesignation] = useState('');
  const [empAttType, setEmpAttType] = useState<AttendanceType>('GPS');
  const [empCreateLogin, setEmpCreateLogin] = useState(true);
  const [empPassword, setEmpPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Target form state
  const currentMonth = businessMonth();
  const [targetMonth, setTargetMonth] = useState(currentMonth);
  const [targetInput, setTargetInput] = useState('');

  // Designation form state
  const [newDesName, setNewDesName] = useState('');
  const [renameDesName, setRenameDesName] = useState('');

  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const activeParam = activeFilter === 'all' ? null : activeFilter === 'active';
  const q = useTeam(debouncedSearch, role, activeParam);

  const activeDesQ = useDesignations(false, sheet?.kind === 'add' || sheet?.kind === 'edit');
  const allDesQ = useDesignations(true, sheet?.kind === 'designations');
  const targetsQ = useTargetsSheet(currentMonth, true);
  const editTargetsQ = useTargetsSheet(targetMonth, sheet?.kind === 'target');

  const createEmp = useCreateEmployee();
  const updateEmp = useUpdateEmployee();
  const setPwdMut = useSetEmployeePassword();
  const createDes = useCreateDesignation();
  const updateDes = useUpdateDesignation();
  const setTargetMut = useSetUserTarget();

  const targetByUser = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of targetsQ.data?.rows ?? []) {
      map.set(row.userId, row.amount);
    }
    return map;
  }, [targetsQ.data]);

  const canManage = (m: UserDto) =>
    isAdmin || (m.role !== 'ADMIN' && m.role !== 'HR');

  const openAdd = () => {
    setEmpName('');
    setEmpPhone('');
    setEmpRole('SALES');
    setEmpDesignation(activeDesQ.data?.[0]?.name ?? '');
    setEmpAttType('GPS');
    setEmpCreateLogin(true);
    setEmpPassword('');
    setFormError(null);
    setSheet({ kind: 'add' });
  };

  const openEdit = (m: UserDto) => {
    setEmpName(m.name);
    setEmpPhone(m.phone);
    setEmpRole((m.role === 'CUSTOMER' ? 'SALES' : m.role) as StaffRole);
    setEmpDesignation(m.designation ?? '');
    setEmpAttType(m.attendanceType ?? 'GPS');
    setFormError(null);
    setSheet({ kind: 'edit', member: m });
  };

  const openPassword = (m: UserDto) => {
    setEmpPassword('');
    setFormError(null);
    setSheet({ kind: 'password', member: m });
  };

  const openTarget = (m: UserDto) => {
    setTargetMonth(currentMonth);
    const cur = targetByUser.get(m.id);
    setTargetInput(cur != null ? String(cur) : '');
    setFormError(null);
    setSheet({ kind: 'target', member: m });
  };

  const submitEmployee = () => {
    setFormError(null);
    if (sheet?.kind === 'add') {
      const parsed = createUserBodySchema.safeParse({
        name: empName,
        phone: empPhone,
        role: empRole,
        designation: empDesignation,
        attendanceType: empAttType,
        fixedSalary: 0,
        ...(empCreateLogin ? { password: empPassword } : {}),
      });
      if (!parsed.success) {
        setFormError(parsed.error.issues[0]?.message ?? 'Check employee details.');
        return;
      }
      createEmp.mutate(parsed.data, {
        onSuccess: () => setSheet(null),
        onError: (e) => setFormError(e instanceof ApiError ? e.message : 'Could not add employee.'),
      });
    } else if (sheet?.kind === 'edit') {
      if (!empName.trim() || !empDesignation.trim()) {
        setFormError('Name and designation are required.');
        return;
      }
      updateEmp.mutate(
        {
          id: sheet.member.id,
          name: empName.trim(),
          role: empRole,
          designation: empDesignation.trim(),
          attendanceType: empAttType,
        },
        {
          onSuccess: () => setSheet(null),
          onError: (e) => setFormError(e instanceof ApiError ? e.message : 'Could not update employee.'),
        },
      );
    }
  };

  const submitPassword = () => {
    if (sheet?.kind !== 'password') return;
    setFormError(null);
    const parsed = setUserPasswordBodySchema.safeParse({ password: empPassword });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Password must be at least 8 characters.');
      return;
    }
    setPwdMut.mutate(
      { id: sheet.member.id, password: parsed.data.password },
      {
        onSuccess: () => {
          setSheet(null);
          Alert.alert('Password updated', `${sheet.member.name} can now sign in with the new password.`);
        },
        onError: (e) => setFormError(e instanceof ApiError ? e.message : 'Could not update password.'),
      },
    );
  };

  const confirmToggleActive = (m: UserDto) => {
    setSheet(null);
    if (m.active) {
      Alert.alert(
        `Deactivate ${m.name}?`,
        'They will be signed out immediately and can no longer access the app.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Deactivate',
            style: 'destructive',
            onPress: () =>
              updateEmp.mutate({ id: m.id, active: false }, { onError: fail('Could not deactivate') }),
          },
        ],
      );
    } else {
      updateEmp.mutate({ id: m.id, active: true }, { onError: fail('Could not reactivate') });
    }
  };

  const submitTarget = () => {
    if (sheet?.kind !== 'target') return;
    const clean = targetInput.replace(/[^0-9]/g, '');
    const amount = clean ? Number.parseInt(clean, 10) : 0;
    if (Number.isNaN(amount) || amount < 0) {
      setFormError('Enter a valid amount in rupees.');
      return;
    }
    setFormError(null);
    setTargetMut.mutate(
      { month: targetMonth, userId: sheet.member.id, amount },
      {
        onSuccess: () => setSheet(null),
        onError: (e) => setFormError(e instanceof ApiError ? e.message : 'Could not save target.'),
      },
    );
  };

  const submitNewDesignation = () => {
    const name = newDesName.trim();
    if (!name) return;
    createDes.mutate(
      { name },
      {
        onSuccess: () => setNewDesName(''),
        onError: fail('Could not add designation'),
      },
    );
  };

  const submitRenameDesignation = () => {
    if (sheet?.kind !== 'rename-designation') return;
    const name = renameDesName.trim();
    if (!name) return;
    updateDes.mutate(
      { id: sheet.d.id, name },
      {
        onSuccess: () => setSheet({ kind: 'designations' }),
        onError: fail('Could not rename designation'),
      },
    );
  };

  const hasFilters = !!search.trim() || !!role || activeFilter !== 'active';
  const people = q.data ?? [];

  const header = (
    <View style={{ gap: space[3], paddingBottom: space[2] }}>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Text variant="title" style={{ textAlign: 'center' }}>
          Team
        </Text>
        {q.data ? (
          <Text variant="caption" muted style={{ fontVariant: ['tabular-nums'] }}>
            {people.length} {people.length === 1 ? 'person' : 'people'}
          </Text>
        ) : null}
      </View>

      <View style={styles.searchRow}>
        <View style={styles.search}>
          <Feather name="search" size={17} color={colors.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search name or phone"
            placeholderTextColor={colors.placeholder}
            returnKeyType="search"
            accessibilityLabel="Search team"
            style={styles.searchInput}
          />
          {search ? (
            <PressableScale onPress={() => setSearch('')} accessibilityLabel="Clear search">
              <Feather name="x" size={15} color={colors.inkMuted} />
            </PressableScale>
          ) : null}
        </View>
        <PressableScale
          onPress={() => {
            setNewDesName('');
            setSheet({ kind: 'designations' });
          }}
          accessibilityRole="button"
          accessibilityLabel="Manage designations"
          style={styles.iconBtn}
        >
          <Feather name="tag" size={16} color={colors.inkDeep} />
        </PressableScale>
        <PressableScale
          onPress={openAdd}
          accessibilityRole="button"
          accessibilityLabel="Add employee"
          style={styles.addBtn}
        >
          <Feather name="plus" size={16} color={colors.primaryForeground} />
          <Text variant="caption" color={colors.primaryForeground} style={{ fontFamily: font.semibold }}>
            Add
          </Text>
        </PressableScale>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2] }}>
        {[undefined, ...STAFF_ROLES].map((r) => {
          const active = r === role;
          return (
            <Chip key={r ?? 'all'} label={r ? ROLE_LABEL[r] : 'All staff'} active={active} onPress={() => setRole(r)} />
          );
        })}
        {hasFilters ? (
          <PressableScale
            onPress={() => {
              setSearch('');
              setRole(undefined);
              setActiveFilter('active');
            }}
            style={styles.clearChip}
          >
            <Feather name="x" size={13} color={colors.destructive} />
            <Text variant="caption" color={colors.destructive}>
              Clear
            </Text>
          </PressableScale>
        ) : null}
      </ScrollView>
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
    empty = <EmptyState icon="briefcase" message="No team members found." />;
  }

  const sheetTitle =
    sheet?.kind === 'add'
      ? 'Add employee'
      : sheet?.kind === 'edit'
        ? `Edit ${sheet.member.name}`
        : sheet?.kind === 'password'
          ? sheet.member.canLogin
            ? 'Reset password'
            : 'Create login'
          : sheet?.kind === 'target'
            ? 'Monthly sales target'
            : sheet?.kind === 'designations'
              ? 'Designations'
              : sheet?.kind === 'rename-designation'
                ? 'Rename designation'
                : sheet?.member.name ?? '';

  const editTargetRow =
    sheet?.kind === 'target'
      ? editTargetsQ.data?.rows.find((r) => r.userId === sheet.member.id)
      : undefined;

  return (
    <View style={styles.root}>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + space[4],
          paddingHorizontal: space[4],
          paddingBottom: space[6],
          gap: space[3],
        }}
        data={people}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => (
          <StaffCard
            member={item}
            isSelf={item.id === user?.id}
            targetAmount={targetByUser.get(item.id)}
            onMenu={() => setSheet({ kind: 'actions', member: item })}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={q.isFetchingNextPage ? <Skeleton height={80} /> : undefined}
        onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
        onEndReachedThreshold={0.5}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching && !q.isFetchingNextPage}
            onRefresh={() => {
              void q.refetch();
              void targetsQ.refetch();
            }}
            tintColor={colors.primary}
          />
        }
      />

      <BottomBar>
        <SlidingSwitch
          options={[
            { value: 'active' as const, label: 'Active' },
            { value: 'all' as const, label: 'All' },
            { value: 'inactive' as const, label: 'Deactivated' },
          ]}
          value={activeFilter}
          onChange={setActiveFilter}
        />
      </BottomBar>

      <BottomSheet
        visible={!!sheet}
        onClose={() => setSheet(null)}
        title={sheetTitle}
        subtitle={
          sheet?.kind === 'actions'
            ? `${sheet.member.designation ?? ROLE_LABEL[sheet.member.role]} · ${formatPhone(sheet.member.phone)}`
            : sheet?.kind === 'target'
              ? sheet.member.name
              : undefined
        }
        footer={
          sheet?.kind === 'add' || sheet?.kind === 'edit' ? (
            <Button
              title={sheet.kind === 'add' ? 'Add employee' : 'Save changes'}
              onPress={submitEmployee}
              loading={createEmp.isPending || updateEmp.isPending}
              fullWidth
            />
          ) : sheet?.kind === 'password' ? (
            <Button
              title={sheet.member.canLogin ? 'Reset password' : 'Create login'}
              onPress={submitPassword}
              loading={setPwdMut.isPending}
              fullWidth
            />
          ) : sheet?.kind === 'target' ? (
            <Button
              title="Save target"
              onPress={submitTarget}
              loading={setTargetMut.isPending}
              fullWidth
            />
          ) : sheet?.kind === 'rename-designation' ? (
            <Button
              title="Save name"
              onPress={submitRenameDesignation}
              loading={updateDes.isPending}
              disabled={!renameDesName.trim()}
              fullWidth
            />
          ) : undefined
        }
      >
        {sheet?.kind === 'actions' ? (
          <View style={{ gap: space[1] }}>
            <PressableScale
              onPress={() => {
                const uid = sheet.member.id;
                setSheet(null);
                router.push({ pathname: '/attendance/[userId]', params: { userId: uid } } as Href);
              }}
              style={styles.sheetActionRow}
            >
              <Feather name="calendar" size={18} color={colors.inkDeep} />
              <Text variant="label" color={colors.inkDeep}>
                View attendance
              </Text>
            </PressableScale>
            {canManage(sheet.member) ? (
              <>
                <PressableScale onPress={() => openEdit(sheet.member)} style={styles.sheetActionRow}>
                  <Feather name="edit-2" size={18} color={colors.inkDeep} />
                  <Text variant="label" color={colors.inkDeep}>
                    Edit employee
                  </Text>
                </PressableScale>
                <PressableScale onPress={() => openPassword(sheet.member)} style={styles.sheetActionRow}>
                  <Feather name="key" size={18} color={colors.inkDeep} />
                  <Text variant="label" color={colors.inkDeep}>
                    {sheet.member.canLogin ? 'Reset password' : 'Create login'}
                  </Text>
                </PressableScale>
              </>
            ) : null}
            {isAdmin || sheet.member.role === 'SALES' ? (
              <PressableScale onPress={() => openTarget(sheet.member)} style={styles.sheetActionRow}>
                <Feather name="target" size={18} color={colors.inkDeep} />
                <Text variant="label" color={colors.inkDeep}>
                  Monthly sales target
                </Text>
              </PressableScale>
            ) : null}
            {canManage(sheet.member) && sheet.member.id !== user?.id ? (
              <PressableScale
                onPress={() => confirmToggleActive(sheet.member)}
                style={styles.sheetActionRow}
              >
                <Feather
                  name={sheet.member.active ? 'user-x' : 'user-check'}
                  size={18}
                  color={sheet.member.active ? colors.destructive : colors.primary}
                />
                <Text
                  variant="label"
                  color={sheet.member.active ? colors.destructive : colors.primary}
                >
                  {sheet.member.active ? 'Deactivate employee' : 'Reactivate employee'}
                </Text>
              </PressableScale>
            ) : null}
          </View>
        ) : sheet?.kind === 'add' || sheet?.kind === 'edit' ? (
          <View style={{ gap: space[3] }}>
            <Input label="Full name" value={empName} onChangeText={setEmpName} placeholder="e.g. Amit Verma" />
            {sheet.kind === 'add' ? (
              <View style={{ gap: 6 }}>
                <Text variant="label" color={colors.inkDeep}>
                  Mobile number
                </Text>
                <PhoneField value={empPhone} onChangeText={setEmpPhone} accessibilityLabel="Mobile number" />
              </View>
            ) : null}

            <View style={{ gap: space[2] }}>
              <Text variant="label" color={colors.inkDeep}>
                Role
              </Text>
              <View style={styles.chipWrap}>
                {allowedRoles.map((r) => {
                  const active = empRole === r;
                  return (
                    <PressableScale
                      key={r}
                      onPress={() => setEmpRole(r)}
                      style={[styles.pickChip, active && styles.pickChipActive]}
                    >
                      <Text
                        variant="caption"
                        color={active ? colors.primaryForeground : colors.inkDeep}
                        style={{ fontFamily: active ? font.semibold : font.medium }}
                      >
                        {ROLE_LABEL[r]}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: space[2] }}>
              <Text variant="label" color={colors.inkDeep}>
                Designation
              </Text>
              {activeDesQ.isPending ? (
                <Skeleton height={36} width="70%" />
              ) : (
                <View style={styles.chipWrap}>
                  {(activeDesQ.data ?? []).map((d) => {
                    const active = empDesignation === d.name;
                    return (
                      <PressableScale
                        key={d.id}
                        onPress={() => setEmpDesignation(d.name)}
                        style={[styles.pickChip, active && styles.pickChipActive]}
                      >
                        <Text
                          variant="caption"
                          color={active ? colors.primaryForeground : colors.inkDeep}
                          style={{ fontFamily: active ? font.semibold : font.medium }}
                        >
                          {d.name}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={{ gap: space[2] }}>
              <Text variant="label" color={colors.inkDeep}>
                Attendance type
              </Text>
              <View style={styles.chipWrap}>
                {ATTENDANCE_TYPES.map((t) => {
                  const active = empAttType === t;
                  return (
                    <PressableScale
                      key={t}
                      onPress={() => setEmpAttType(t)}
                      style={[styles.pickChip, active && styles.pickChipActive]}
                    >
                      <Text
                        variant="caption"
                        color={active ? colors.primaryForeground : colors.inkDeep}
                        style={{ fontFamily: active ? font.semibold : font.medium }}
                      >
                        {ATT_LABEL[t]}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            </View>

            {sheet.kind === 'add' ? (
              <View style={{ gap: space[2] }}>
                <PressableScale
                  onPress={() => {
                    softTick();
                    setEmpCreateLogin((v) => !v);
                  }}
                  style={styles.toggleRow}
                >
                  <View style={[styles.checkbox, empCreateLogin && styles.checkboxChecked]}>
                    {empCreateLogin ? (
                      <Feather name="check" size={13} color={colors.primaryForeground} />
                    ) : null}
                  </View>
                  <Text variant="label" color={colors.inkDeep}>
                    Create app login
                  </Text>
                </PressableScale>
                {empCreateLogin ? (
                  <Input
                    label="Initial password (min 8 chars)"
                    value={empPassword}
                    onChangeText={setEmpPassword}
                    placeholder="At least 8 characters"
                    secureTextEntry
                  />
                ) : null}
              </View>
            ) : null}

            {formError ? (
              <Text variant="caption" color={colors.destructive}>
                {formError}
              </Text>
            ) : null}
          </View>
        ) : sheet?.kind === 'password' ? (
          <View style={{ gap: space[3] }}>
            <Text variant="caption" muted>
              {sheet.member.canLogin
                ? 'Setting a new password will sign this user out of all devices immediately.'
                : 'Creates an app login so this employee can sign in with their phone and password.'}
            </Text>
            <Input
              label="New password (min 8 chars)"
              value={empPassword}
              onChangeText={setEmpPassword}
              placeholder="At least 8 characters"
              secureTextEntry
            />
            {formError ? (
              <Text variant="caption" color={colors.destructive}>
                {formError}
              </Text>
            ) : null}
          </View>
        ) : sheet?.kind === 'target' ? (
          <View style={{ gap: space[3] }}>
            <View style={styles.monthStepper}>
              <PressableScale
                onPress={() => {
                  const next = addMonths(targetMonth, -1);
                  setTargetMonth(next);
                }}
                style={styles.stepBtn}
              >
                <Feather name="chevron-left" size={18} color={colors.inkDeep} />
              </PressableScale>
              <Text variant="label" color={colors.inkDeep} style={{ flex: 1, textAlign: 'center' }}>
                {formatMonthLabel(targetMonth)}
              </Text>
              <PressableScale
                onPress={() => {
                  const next = addMonths(targetMonth, 1);
                  setTargetMonth(next);
                }}
                style={styles.stepBtn}
              >
                <Feather name="chevron-right" size={18} color={colors.inkDeep} />
              </PressableScale>
            </View>
            {editTargetRow ? (
              <Text variant="caption" muted style={{ fontVariant: ['tabular-nums'] }}>
                Current target: {formatINR(editTargetRow.amount)}
                {editTargetRow.carriedFrom
                  ? ` (carried from ${formatMonthLabel(editTargetRow.carriedFrom)})`
                  : ''}
              </Text>
            ) : null}
            <Input
              label="Target amount in ₹"
              value={targetInput}
              onChangeText={(t) => setTargetInput(t.replace(/[^0-9]/g, ''))}
              placeholder="e.g. 1500000"
              keyboardType="number-pad"
            />
            {formError ? (
              <Text variant="caption" color={colors.destructive}>
                {formError}
              </Text>
            ) : null}
          </View>
        ) : sheet?.kind === 'designations' ? (
          <View style={{ gap: space[3] }}>
            <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Add designation"
                  value={newDesName}
                  onChangeText={setNewDesName}
                  placeholder="e.g. Senior Designer"
                  maxLength={60}
                />
              </View>
              <Button
                title="Add"
                onPress={submitNewDesignation}
                loading={createDes.isPending}
                disabled={!newDesName.trim()}
              />
            </View>
            {allDesQ.isPending ? <Skeleton height={64} /> : null}
            <View style={styles.desGroup}>
              {(allDesQ.data ?? []).map((d, i) => (
                <View key={d.id} style={[styles.desRow, i > 0 && styles.desDivider]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text
                      variant="label"
                      color={d.active ? colors.inkDeep : colors.inkMuted}
                      numberOfLines={1}
                    >
                      {d.name}
                    </Text>
                    {!d.active ? (
                      <Text variant="caption" color={colors.inkMuted}>
                        Inactive
                      </Text>
                    ) : null}
                  </View>
                  <PressableScale
                    onPress={() => {
                      setRenameDesName(d.name);
                      setSheet({ kind: 'rename-designation', d });
                    }}
                    accessibilityLabel={`Rename ${d.name}`}
                    style={styles.moreBtn}
                  >
                    <Feather name="edit-2" size={15} color={colors.inkMuted} />
                  </PressableScale>
                  <PressableScale
                    onPress={() => {
                      if (d.active) {
                        Alert.alert(`Deactivate "${d.name}"?`, 'It will be hidden from new employee forms.', [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Deactivate',
                            style: 'destructive',
                            onPress: () =>
                              updateDes.mutate(
                                { id: d.id, active: false },
                                { onError: fail('Could not update designation') },
                              ),
                          },
                        ]);
                      } else {
                        updateDes.mutate(
                          { id: d.id, active: true },
                          { onError: fail('Could not update designation') },
                        );
                      }
                    }}
                    accessibilityLabel={d.active ? `Deactivate ${d.name}` : `Activate ${d.name}`}
                    style={styles.moreBtn}
                  >
                    <Feather
                      name={d.active ? 'slash' : 'check-circle'}
                      size={15}
                      color={d.active ? colors.destructive : colors.primary}
                    />
                  </PressableScale>
                </View>
              ))}
            </View>
          </View>
        ) : sheet?.kind === 'rename-designation' ? (
          <Input
            label="Designation name"
            value={renameDesName}
            onChangeText={setRenameDesName}
            placeholder="Designation name"
            maxLength={60}
            autoFocus
          />
        ) : null}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  cardMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 2,
  },
  moreBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.card,
  },
  searchInput: { flex: 1, fontFamily: font.regular, fontSize: 15, color: colors.foreground },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 44,
    paddingHorizontal: space[3],
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  clearChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space[3],
    height: 34,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  sheetActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: hit,
    paddingHorizontal: space[2],
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  pickChip: {
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
  pickChipActive: {
    backgroundColor: colors.tealStrong,
    borderColor: colors.tealStrong,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    minHeight: 40,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.tealStrong,
    borderColor: colors.tealStrong,
  },
  monthStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.pageSoft,
    paddingHorizontal: space[1],
  },
  stepBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desGroup: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.pageSoft,
    paddingHorizontal: space[3],
  },
  desRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    minHeight: hit,
  },
  desDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
