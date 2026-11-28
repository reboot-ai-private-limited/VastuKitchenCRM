import type React from 'react';
import { useState } from 'react';
import { Alert, Linking, Share, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import type { DesignStage, ProjectDto, RoleName } from '@vastu/contracts';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, font, hit, radius, space, tone } from '@/constants/theme';
import { describeActivity } from '@/features/leads/lead-meta';
import { ApiError } from '@/lib/api/client';
import { listUsers } from '@/lib/api/endpoints/users';
import { formatDate, formatINR, formatTime } from '@/lib/format';
import { softTick } from '@/lib/haptics';
import { openLink, telUrl, whatsappUrlFor } from '@/lib/phone';
import {
  DESIGN_LABEL,
  DESIGN_SUB_LABEL,
  DESIGN_TONE,
  STAGE_LABEL,
  STAGE_TONE,
} from './project-meta';
import { SlidingSwitch } from './sliding-switch';
import {
  useChangeDesignStage,
  useChangeStage,
  useCloseProject,
  useInviteCustomer,
  useProjectJourney,
  useSetMembers,
  useUpdateProject,
} from './use-projects';

type SheetMode = 'overview' | 'edit' | 'team' | 'invite' | 'journey';

const DESIGN_ORDER: DesignStage[] = ['NOT_STARTED', 'IN_DESIGN', 'SHARED', 'APPROVED'];
const STAGE_OPTIONS = [
  { value: 'DESIGN', label: STAGE_LABEL.DESIGN, icon: 'pen-tool' },
  { value: 'SITE', label: STAGE_LABEL.SITE, icon: 'tool' },
] as const;

/** What this viewer may do. The server decides in the end; this only hides what it would refuse. */
export function projectPermissions(project: ProjectDto, user: { id: string; role: RoleName } | null) {
  const role = user?.role;
  const isAdmin = role === 'ADMIN';
  return {
    isAdmin,
    isStaff: !!role && role !== 'CUSTOMER',
    /** Route allows ADMIN + DESIGNER; the use case then needs Admin or this project's own designer. */
    canChangeDesignStage: isAdmin || (role === 'DESIGNER' && project.designer?.id === user?.id),
    canChangeStage: isAdmin,
    canClose: isAdmin,
    canInvite: role === 'ADMIN' || role === 'SALES',
    canSeeJourney: !!project.leadId && (role === 'ADMIN' || role === 'SALES' || role === 'OFFICE'),
  };
}

type Props = {
  project: ProjectDto;
  user: { id: string; role: RoleName } | null;
  visible: boolean;
  onClose: () => void;
  /** The server refused to close without a Final delivery post: open the chat in that mode. */
  onNeedFinalDelivery: () => void;
};

type FeatherName = React.ComponentProps<typeof Feather>['name'];

function QuickAction({
  icon,
  label,
  iconColor = colors.inkDeep,
  onPress,
}: {
  icon: FeatherName;
  label: string;
  iconColor?: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={() => {
        softTick();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.quickBtn}
    >
      <Feather name={icon} size={17} color={iconColor} />
      <Text variant="caption" color={colors.inkDeep} style={{ fontFamily: font.semibold }}>
        {label}
      </Text>
    </PressableScale>
  );
}

function DesignTrack({
  value,
  disabled,
  onChange,
}: {
  value: DesignStage;
  disabled: boolean;
  onChange: (next: DesignStage) => void;
}) {
  const activeIdx = Math.max(0, DESIGN_ORDER.indexOf(value));
  return (
    <View style={[styles.trackWrap, disabled && { opacity: 0.55 }]} accessibilityRole="radiogroup">
      {DESIGN_ORDER.map((step, i) => {
        const done = i <= activeIdx;
        const current = i === activeIdx;
        return (
          <PressableScale
            key={step}
            disabled={disabled}
            onPress={() => {
              if (step !== value) {
                softTick();
                onChange(step);
              }
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: current, disabled }}
            accessibilityLabel={DESIGN_LABEL[step]}
            style={styles.trackStep}
          >
            <View style={styles.trackRailRow}>
              <View
                style={[
                  styles.trackLine,
                  i === 0 && styles.trackLineHidden,
                  done && i > 0 && styles.trackLineDone,
                ]}
              />
              <View
                style={[
                  styles.trackDot,
                  done && styles.trackDotDone,
                  current && styles.trackDotCurrent,
                ]}
              />
              <View
                style={[
                  styles.trackLine,
                  i === DESIGN_ORDER.length - 1 && styles.trackLineHidden,
                  i < activeIdx && styles.trackLineDone,
                ]}
              />
            </View>
            <Text
              variant="caption"
              numberOfLines={1}
              color={current ? colors.inkDeep : colors.inkMuted}
              style={[styles.trackLabel, current && { fontFamily: font.semibold }]}
            >
              {DESIGN_SUB_LABEL[step]}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

function ActionRow({
  icon,
  label,
  destructive = false,
  disabled = false,
  divider = false,
  onPress,
}: {
  icon: FeatherName;
  label: string;
  destructive?: boolean;
  disabled?: boolean;
  divider?: boolean;
  onPress: () => void;
}) {
  const fg = destructive ? colors.destructive : colors.inkDeep;
  const iconFg = destructive ? colors.destructive : colors.inkMuted;
  return (
    <PressableScale
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[styles.listRow, divider && styles.rowDivider, disabled && { opacity: 0.5 }]}
    >
      <Feather name={icon} size={18} color={iconFg} />
      <Text variant="label" color={fg} style={{ flex: 1 }}>
        {label}
      </Text>
      {!destructive ? <Feather name="chevron-right" size={16} color={colors.inkMuted} /> : null}
    </PressableScale>
  );
}

function MetaRow({
  label,
  value,
  divider = false,
  numeric = false,
  onPress,
}: {
  label: string;
  value: string;
  divider?: boolean;
  numeric?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <View style={[styles.metaRow, divider && styles.rowDivider]}>
      <Text variant="caption" color={colors.inkMuted} style={styles.metaLabel}>
        {label}
      </Text>
      <View style={styles.metaValueWrap}>
        <Text
          variant="label"
          color={onPress ? colors.primaryPressed : colors.inkDeep}
          numberOfLines={2}
          style={[styles.metaValue, numeric && styles.tabular]}
        >
          {value}
        </Text>
        {onPress ? <Feather name="arrow-up-right" size={14} color={colors.primaryPressed} /> : null}
      </View>
    </View>
  );

  if (!onPress) return content;
  return (
    <PressableScale onPress={onPress} accessibilityRole="link" accessibilityLabel={`${label}: ${value}`}>
      {content}
    </PressableScale>
  );
}

const fail = (title: string) => (e: unknown) =>
  Alert.alert(title, e instanceof ApiError ? e.message : 'Something went wrong. Try again.');

export function InfoSheet({ project, user, visible, onClose, onNeedFinalDelivery }: Props) {
  const router = useRouter();
  const perms = projectPermissions(project, user);
  const closed = project.stage === 'CLOSED';
  const stage = useChangeStage(project.id);
  const design = useChangeDesignStage(project.id);
  const close = useCloseProject(project.id);
  const invite = useInviteCustomer();
  const updateMut = useUpdateProject(project.id);
  const membersMut = useSetMembers(project.id);

  const [mode, setMode] = useState<SheetMode>('overview');
  const [editName, setEditName] = useState(project.name);
  const [editSite, setEditSite] = useState(project.siteAddress ?? '');
  const [editValue, setEditValue] = useState(project.value != null ? String(project.value) : '');
  const [pickedMembers, setPickedMembers] = useState<string[]>([]);
  const [pickedDesigner, setPickedDesigner] = useState<string | null>(null);
  const [inviteData, setInviteData] = useState<{ url: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const staffQ = useQuery({
    queryKey: ['users', 'staff-all'],
    queryFn: ({ signal }) => listUsers({ active: true, pageSize: 100 }, signal),
    enabled: visible && mode === 'team' && perms.isAdmin,
    staleTime: 60_000,
  });
  const staff = (staffQ.data?.items ?? []).filter((u) => u.role !== 'CUSTOMER');

  const journeyQ = useProjectJourney(project.id, visible && mode === 'journey' && !!project.leadId);

  const handleClose = () => {
    setMode('overview');
    setCopied(false);
    onClose();
  };

  const openEdit = () => {
    setEditName(project.name);
    setEditSite(project.siteAddress ?? '');
    setEditValue(project.value != null ? String(project.value) : '');
    setMode('edit');
  };

  const saveEdit = () => {
    const name = editName.trim();
    if (!name) {
      Alert.alert('Project name required', 'Enter a name for this project.');
      return;
    }
    const cleanSite = editSite.trim();
    const cleanVal = editValue.replace(/[^0-9]/g, '');
    const parsedVal = cleanVal ? Number.parseInt(cleanVal, 10) : null;
    updateMut.mutate(
      {
        name,
        siteAddress: cleanSite || null,
        value: parsedVal !== null && !Number.isNaN(parsedVal) ? parsedVal : null,
      },
      {
        onSuccess: () => setMode('overview'),
        onError: fail('Could not update project'),
      },
    );
  };

  const openTeam = () => {
    setPickedMembers(project.members.map((m) => m.id));
    setPickedDesigner(project.designer?.id ?? null);
    setMode('team');
  };

  const toggleMember = (id: string) => {
    softTick();
    setPickedMembers((prev) => {
      if (prev.includes(id)) {
        if (pickedDesigner === id) setPickedDesigner(null);
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  };

  const selectDesigner = (id: string) => {
    softTick();
    if (pickedDesigner === id) {
      setPickedDesigner(null);
    } else {
      setPickedDesigner(id);
      setPickedMembers((prev) => (prev.includes(id) ? prev : [...prev, id]));
    }
  };

  const saveTeam = () => {
    membersMut.mutate(
      { memberIds: pickedMembers, designerId: pickedDesigner },
      {
        onSuccess: () => setMode('overview'),
        onError: fail('Could not update team'),
      },
    );
  };

  const confirmClose = () =>
    Alert.alert('Close this project?', 'The customer and team will be told.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Close project',
        style: 'destructive',
        onPress: () =>
          close.mutate(undefined, {
            onError: (e) => {
              if (e instanceof ApiError && e.status === 409 && /final delivery/i.test(e.message)) {
                Alert.alert(
                  'Add a Final Delivery post first.',
                  'Closing needs a Final delivery post with photos.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Add final delivery',
                      onPress: () => {
                        handleClose();
                        onNeedFinalDelivery();
                      },
                    },
                  ],
                );
              } else fail('Could not close')(e);
            },
          }),
      },
    ]);

  const sendInvite = () =>
    invite.mutate(project.customer.id, {
      onSuccess: (r) => {
        setInviteData(r);
        setCopied(false);
        setMode('invite');
      },
      onError: fail('Could not create the invite'),
    });

  const mapsUrl = project.siteAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(project.siteAddress)}`
    : null;

  const actions: {
    key: string;
    icon: FeatherName;
    label: string;
    disabled?: boolean;
    onPress: () => void;
  }[] = [];

  if (perms.isAdmin && !closed) {
    actions.push({
      key: 'edit',
      icon: 'edit-2',
      label: 'Edit project details',
      onPress: openEdit,
    });
  }
  if (project.leadId && perms.isStaff) {
    actions.push({
      key: 'journey',
      icon: 'git-branch',
      label: 'Lead journey',
      onPress: () => setMode('journey'),
    });
  }
  if (perms.canInvite) {
    actions.push({
      key: 'invite',
      icon: 'user-plus',
      label: 'Invite customer',
      disabled: invite.isPending,
      onPress: sendInvite,
    });
  }
  if (perms.isStaff && !closed) {
    actions.push({
      key: 'final-delivery',
      icon: 'check-circle',
      label: 'Post final delivery',
      onPress: () => {
        handleClose();
        onNeedFinalDelivery();
      },
    });
  }
  if (perms.canChangeStage && closed) {
    for (const o of STAGE_OPTIONS) {
      actions.push({
        key: `reopen-${o.value}`,
        icon: 'rotate-ccw',
        label: `Reopen in ${o.value === 'SITE' ? 'Site work' : 'Design'}`,
        disabled: stage.isPending,
        onPress: () => stage.mutate(o.value, { onError: fail('Could not reopen') }),
      });
    }
  }

  const sheetTitle =
    mode === 'edit'
      ? 'Edit project'
      : mode === 'team'
        ? 'Manage team'
        : mode === 'invite'
          ? 'Customer invite'
          : mode === 'journey'
            ? 'Lead journey'
            : project.name;

  const sheetSubtitle = mode === 'overview' ? project.customer.name : project.name;

  const sheetFooter =
    mode === 'edit' ? (
      <View style={styles.footerRow}>
        <View style={{ flex: 1 }}>
          <Button title="Back" variant="outline" onPress={() => setMode('overview')} fullWidth />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Save"
            onPress={saveEdit}
            loading={updateMut.isPending}
            disabled={!editName.trim()}
            fullWidth
          />
        </View>
      </View>
    ) : mode === 'team' ? (
      <View style={styles.footerRow}>
        <View style={{ flex: 1 }}>
          <Button title="Back" variant="outline" onPress={() => setMode('overview')} fullWidth />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Save team" onPress={saveTeam} loading={membersMut.isPending} fullWidth />
        </View>
      </View>
    ) : mode === 'invite' ? (
      <Button title="Back" variant="outline" onPress={() => setMode('overview')} fullWidth />
    ) : mode === 'journey' ? (
      <View style={styles.footerRow}>
        <View style={{ flex: 1 }}>
          <Button title="Back" variant="outline" onPress={() => setMode('overview')} fullWidth />
        </View>
        {perms.canSeeJourney && project.leadId ? (
          <View style={{ flex: 1 }}>
            <Button
              title="Open lead"
              onPress={() => {
                handleClose();
                router.push({ pathname: '/leads/[id]', params: { id: project.leadId as string } });
              }}
              fullWidth
            />
          </View>
        ) : null}
      </View>
    ) : undefined;

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      title={sheetTitle}
      subtitle={sheetSubtitle}
      footer={sheetFooter}
    >
      {mode === 'edit' ? (
        <View style={styles.body}>
          <Input label="Project name" value={editName} onChangeText={setEditName} placeholder="Project name" />
          <Input
            label="Site address"
            value={editSite}
            onChangeText={setEditSite}
            placeholder="Full site address"
          />
          <Input
            label="Project value in ₹"
            value={editValue}
            onChangeText={(t) => setEditValue(t.replace(/[^0-9]/g, ''))}
            placeholder="e.g. 450000"
            keyboardType="number-pad"
          />
        </View>
      ) : mode === 'team' ? (
        <View style={styles.body}>
          <Text variant="caption" muted>
            Select team members with access to this project. Tap Designer to assign the lead designer.
          </Text>
          {staffQ.isPending ? (
            <View style={{ gap: space[2] }}>
              <Skeleton height={48} />
              <Skeleton height={48} />
              <Skeleton height={48} />
            </View>
          ) : (
            <View style={styles.group}>
              {staff.map((u, i) => {
                const isMember = pickedMembers.includes(u.id);
                const isDes = pickedDesigner === u.id;
                return (
                  <View key={u.id} style={[styles.teamPickRow, i > 0 && styles.rowDivider]}>
                    <PressableScale
                      onPress={() => toggleMember(u.id)}
                      style={styles.teamPickMain}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isMember }}
                    >
                      <View style={[styles.checkbox, isMember && styles.checkboxChecked]}>
                        {isMember ? <Feather name="check" size={13} color={colors.primaryForeground} /> : null}
                      </View>
                      <Avatar name={u.name} size={32} accent={u.id === user?.id} />
                      <View style={{ flex: 1 }}>
                        <Text variant="label" color={colors.inkDeep} numberOfLines={1}>
                          {u.name}
                        </Text>
                        <Text variant="caption" color={colors.inkMuted} numberOfLines={1}>
                          {u.designation ?? u.role}
                        </Text>
                      </View>
                    </PressableScale>
                    <PressableScale
                      onPress={() => selectDesigner(u.id)}
                      style={[styles.designerPill, isDes && styles.designerPillActive]}
                    >
                      <Text
                        variant="caption"
                        color={isDes ? colors.primaryForeground : colors.inkMuted}
                        style={{ fontFamily: isDes ? font.semibold : font.medium }}
                      >
                        Designer
                      </Text>
                    </PressableScale>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      ) : mode === 'invite' && inviteData ? (
        <View style={styles.body}>
          <Text variant="caption" muted>
            Share this one-time link with {project.customer.name} so they can view updates and documents.
          </Text>
          <View style={styles.inviteBox}>
            <Text variant="caption" color={colors.inkDeep} selectable>
              {inviteData.url}
            </Text>
            <Text variant="caption" color={colors.inkMuted} style={styles.tabular}>
              Expires {formatDate(inviteData.expiresAt)}
            </Text>
          </View>
          <View style={{ gap: space[2] }}>
            <Button
              title={copied ? 'Link copied' : 'Copy link'}
              onPress={() => {
                void Clipboard.setStringAsync(inviteData.url).then(() => {
                  softTick();
                  setCopied(true);
                });
              }}
              fullWidth
            />
            <Button
              title="Send on WhatsApp"
              variant="outline"
              onPress={() =>
                void openLink(
                  whatsappUrlFor(
                    project.customer.phone,
                    `Hi ${project.customer.name}, here is your Vastu Kitchen project link: ${inviteData.url}`,
                  ),
                )
              }
              fullWidth
            />
            <Button
              title="Share via..."
              variant="outline"
              onPress={() =>
                void Share.share({
                  message: `Your Vastu Kitchen project link: ${inviteData.url}`,
                }).catch(() => undefined)
              }
              fullWidth
            />
          </View>
        </View>
      ) : mode === 'journey' ? (
        <View style={styles.body}>
          {journeyQ.isPending ? (
            <View style={{ gap: space[3] }}>
              <Skeleton height={44} />
              <Skeleton height={44} />
              <Skeleton height={44} />
            </View>
          ) : journeyQ.isError ? (
            <Text variant="caption" muted>
              Could not load lead journey.
            </Text>
          ) : (journeyQ.data ?? []).length === 0 ? (
            <Text variant="caption" muted>
              No lead activity recorded.
            </Text>
          ) : (
            <View style={styles.journeyList}>
              {(journeyQ.data ?? []).map((act, idx, arr) => {
                const desc = describeActivity(act);
                const actor = act.by?.name ?? 'System';
                const isLast = idx === arr.length - 1;
                return (
                  <View key={act.id} style={styles.journeyItem}>
                    <View style={styles.journeyRail}>
                      <Avatar name={actor} size={32} accent={act.by?.id === user?.id} />
                      {!isLast ? <View style={styles.journeyLine} /> : null}
                    </View>
                    <View style={styles.journeyContent}>
                      <Text variant="label" color={colors.inkDeep}>
                        {desc.title}
                      </Text>
                      {desc.detail ? (
                        <Text variant="caption" color={colors.inkMuted}>
                          {desc.detail}
                        </Text>
                      ) : null}
                      <Text variant="caption" color={colors.inkMuted} style={styles.tabular}>
                        {formatDate(act.at)} · {formatTime(act.at)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.body}>
          <View style={styles.quickRow}>
            <QuickAction
              icon="phone"
              label="Call"
              onPress={() => void openLink(telUrl(project.customer.phone))}
            />
            <QuickAction
              icon="message-circle"
              label="WhatsApp"
              iconColor={tone.success.fg}
              onPress={() => void openLink(whatsappUrlFor(project.customer.phone))}
            />
            {mapsUrl ? (
              <QuickAction
                icon="map-pin"
                label="Maps"
                iconColor={tone.info.fg}
                onPress={() => void Linking.openURL(mapsUrl).catch(() => undefined)}
              />
            ) : null}
          </View>

          <View style={styles.statusBlock}>
            {perms.canChangeStage && !closed ? (
              <SlidingSwitch
                options={STAGE_OPTIONS}
                value={project.stage === 'SITE' ? 'SITE' : 'DESIGN'}
                disabled={stage.isPending}
                onChange={(s) => stage.mutate(s, { onError: fail('Could not change the stage') })}
              />
            ) : (
              <View style={styles.statusRow}>
                <Text variant="caption" color={colors.inkMuted}>
                  Stage
                </Text>
                <Badge
                  label={
                    closed
                      ? `Closed${project.closedAt ? ` · ${formatDate(project.closedAt)}` : ''}`
                      : STAGE_LABEL[project.stage]
                  }
                  t={STAGE_TONE[project.stage]}
                />
              </View>
            )}

            {!closed ? (
              perms.canChangeDesignStage ? (
                <DesignTrack
                  value={project.designStage}
                  disabled={design.isPending}
                  onChange={(d) => design.mutate(d, { onError: fail('Could not change the design stage') })}
                />
              ) : (
                <View style={[styles.statusRow, styles.rowDivider]}>
                  <Text variant="caption" color={colors.inkMuted}>
                    Design
                  </Text>
                  <Badge label={DESIGN_LABEL[project.designStage]} t={DESIGN_TONE[project.designStage]} />
                </View>
              )
            ) : null}
          </View>

          <View style={styles.group}>
            <MetaRow label="Phone" value={project.customer.phone} numeric />
            {project.siteAddress ? (
              <MetaRow
                label="Site"
                value={project.siteAddress}
                divider
                onPress={mapsUrl ? () => void Linking.openURL(mapsUrl).catch(() => undefined) : undefined}
              />
            ) : null}
            {project.value != null && !closed ? (
              <MetaRow label="Value" value={formatINR(project.value)} divider numeric />
            ) : null}
            <MetaRow label="Created" value={formatDate(project.createdAt)} divider numeric />
          </View>

          <View style={styles.teamBlock}>
            <View style={styles.teamHeader}>
              <Text variant="label" color={colors.inkDeep} style={styles.groupTitle}>
                Team{project.members.length > 0 ? ` (${project.members.length})` : ''}
              </Text>
              {perms.isAdmin && !closed ? (
                <PressableScale onPress={openTeam} style={styles.manageLink}>
                  <Text variant="caption" color={colors.tealStrong} style={{ fontFamily: font.semibold }}>
                    Manage
                  </Text>
                </PressableScale>
              ) : null}
            </View>
            {project.members.length === 0 ? (
              <Text variant="caption" muted>
                No team members assigned
              </Text>
            ) : (
              <View style={styles.group}>
                {project.members.map((m, i) => {
                  const isDesigner = project.designer?.id === m.id;
                  return (
                    <View key={m.id} style={[styles.member, i > 0 && styles.rowDivider]}>
                      <Avatar name={m.name} size={32} accent={m.id === user?.id} />
                      <View style={{ flex: 1 }}>
                        <Text variant="label" color={colors.inkDeep} numberOfLines={1}>
                          {m.name}
                        </Text>
                        {m.designation ? (
                          <Text variant="caption" color={colors.inkMuted} numberOfLines={1}>
                            {m.designation}
                          </Text>
                        ) : null}
                      </View>
                      {isDesigner ? <Badge label="Designer" t="accent" /> : null}
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {actions.length > 0 ? (
            <View style={styles.group}>
              {actions.map((a, i) => (
                <ActionRow
                  key={a.key}
                  icon={a.icon}
                  label={a.label}
                  disabled={a.disabled}
                  divider={i > 0}
                  onPress={a.onPress}
                />
              ))}
            </View>
          ) : null}

          {perms.canClose && !closed ? (
            <View style={styles.group}>
              <ActionRow
                icon="archive"
                label="Close project"
                destructive
                disabled={close.isPending}
                onPress={confirmClose}
              />
            </View>
          ) : null}
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: space[4],
  },
  quickRow: {
    flexDirection: 'row',
    gap: space[2],
  },
  quickBtn: {
    flex: 1,
    minHeight: hit,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    backgroundColor: colors.pageSoft,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    paddingHorizontal: space[2],
  },
  statusBlock: {
    gap: space[3],
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space[2],
  },
  trackWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: space[1],
  },
  trackStep: {
    flex: 1,
    minHeight: hit,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  trackRailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  trackLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
  },
  trackLineHidden: {
    backgroundColor: 'transparent',
  },
  trackLineDone: {
    backgroundColor: colors.primary,
  },
  trackDot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  trackDotDone: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  trackDotCurrent: {
    width: 14,
    height: 14,
    borderWidth: 3,
    borderColor: colors.primarySoft,
    backgroundColor: colors.primary,
  },
  trackLabel: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  group: {
    backgroundColor: colors.pageSoft,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    paddingHorizontal: space[3],
  },
  groupTitle: {
    fontFamily: font.semibold,
    paddingHorizontal: 2,
  },
  teamBlock: {
    gap: space[2],
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    minHeight: 42,
    paddingVertical: space[2],
  },
  metaLabel: {
    flexShrink: 0,
  },
  metaValueWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  metaValue: {
    textAlign: 'right',
    flexShrink: 1,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[2],
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: hit,
    paddingVertical: space[2],
  },
  footerRow: {
    flexDirection: 'row',
    gap: space[2],
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  manageLink: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: space[2],
  },
  teamPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingVertical: space[2],
  },
  teamPickMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    minHeight: hit,
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
  designerPill: {
    paddingHorizontal: space[2],
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  designerPillActive: {
    backgroundColor: colors.tealStrong,
    borderColor: colors.tealStrong,
  },
  inviteBox: {
    padding: space[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.pageSoft,
    gap: space[2],
  },
  journeyList: {
    gap: 0,
  },
  journeyItem: {
    flexDirection: 'row',
    gap: space[3],
  },
  journeyRail: {
    alignItems: 'center',
    width: 28,
  },
  journeyLine: {
    flex: 1,
    width: 1.5,
    backgroundColor: colors.border,
    marginVertical: 4,
    minHeight: 16,
  },
  journeyContent: {
    flex: 1,
    gap: 2,
    paddingBottom: space[4],
  },
});
