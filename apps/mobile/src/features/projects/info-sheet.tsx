import type React from 'react';
import { Alert, Linking, Share, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { DesignStage, ProjectDto, RoleName } from '@vastu/contracts';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, font, hit, radius, space, tone } from '@/constants/theme';
import { ApiError } from '@/lib/api/client';
import { formatDate, formatINR } from '@/lib/format';
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
} from './use-projects';

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
                        onClose();
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
      onSuccess: (r) =>
        void Share.share({ message: `Your Vastu Kitchen project link: ${r.url}` }).catch(() => undefined),
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

  if (perms.canSeeJourney && project.leadId) {
    actions.push({
      key: 'journey',
      icon: 'git-branch',
      label: 'Lead journey',
      onPress: () => {
        onClose();
        router.push({ pathname: '/leads/[id]', params: { id: project.leadId as string } });
      },
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
        onClose();
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

  return (
    <BottomSheet visible={visible} onClose={onClose} title={project.name} subtitle={project.customer.name}>
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
          <Text variant="label" color={colors.inkDeep} style={styles.groupTitle}>
            Team{project.members.length > 0 ? ` (${project.members.length})` : ''}
          </Text>
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
});
