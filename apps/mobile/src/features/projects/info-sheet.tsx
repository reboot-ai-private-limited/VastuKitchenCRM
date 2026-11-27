import type React from 'react';
import { Alert, Linking, Share, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { DesignStage, ProjectDto, RoleName } from '@vastu/contracts';
import { Avatar } from '@/components/ui/avatar';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import { colors, font, radius, space } from '@/constants/theme';
import { ApiError } from '@/lib/api/client';
import { formatDate, formatINR } from '@/lib/format';
import { openLink, telUrl, whatsappUrlFor } from '@/lib/phone';
import { DESIGN_LABEL, DESIGN_TONE, STAGE_LABEL, STAGE_TONE } from './project-meta';
import { SheetRow } from './sheet-row';
import { SlidingSwitch } from './sliding-switch';
import { useChangeDesignStage, useChangeStage, useCloseProject, useInviteCustomer } from './use-projects';

const DESIGN_ORDER: DesignStage[] = ['NOT_STARTED', 'IN_DESIGN', 'SHARED', 'APPROVED'];
const DESIGN_ICON = {
  NOT_STARTED: 'circle',
  IN_DESIGN: 'edit-3',
  SHARED: 'send',
  APPROVED: 'check-circle',
} as const;
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

/** A titled block, tagged like the chat's event cards. */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space[2] }}>
      <Text variant="caption" color={colors.inkMuted} style={{ fontFamily: font.semibold }}>
        {label.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text variant="caption" color={colors.inkMuted}>
        {label}
      </Text>
      <Text variant="label" color={colors.inkDeep}>
        {value}
      </Text>
    </View>
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
                Alert.alert('Add a Final Delivery post first.', 'Closing needs a Final delivery post with photos.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Add final delivery',
                    onPress: () => {
                      onClose();
                      onNeedFinalDelivery();
                    },
                  },
                ]);
              } else fail('Could not close')(e);
            },
          }),
      },
    ]);

  const sendInvite = () =>
    invite.mutate(project.customer.id, {
      onSuccess: (r) => void Share.share({ message: `Your Vastu Kitchen project link: ${r.url}` }).catch(() => undefined),
      onError: fail('Could not create the invite'),
    });

  const mapsUrl = project.siteAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(project.siteAddress)}`
    : null;

  return (
    <BottomSheet visible={visible} onClose={onClose} title={project.name} subtitle={project.customer.name}>
      <View style={{ gap: space[4] }}>
        <Section label="Stage">
          {perms.canChangeStage && !closed ? (
            <SlidingSwitch
              options={STAGE_OPTIONS}
              value={project.stage === 'SITE' ? 'SITE' : 'DESIGN'}
              disabled={stage.isPending}
              onChange={(s) => stage.mutate(s, { onError: fail('Could not change the stage') })}
            />
          ) : (
            <Badge
              label={closed ? `Closed${project.closedAt ? ` ${formatDate(project.closedAt)}` : ''}` : STAGE_LABEL[project.stage]}
              t={STAGE_TONE[project.stage]}
            />
          )}
        </Section>

        {!closed ? (
          <Section label="Design stage">
            {perms.canChangeDesignStage ? (
              DESIGN_ORDER.map((d) => (
                <SheetRow
                  key={d}
                  icon={DESIGN_ICON[d]}
                  t={DESIGN_TONE[d]}
                  label={DESIGN_LABEL[d]}
                  selected={project.designStage === d}
                  disabled={design.isPending}
                  onPress={() => {
                    if (project.designStage !== d) {
                      design.mutate(d, { onError: fail('Could not change the design stage') });
                    }
                  }}
                />
              ))
            ) : (
              <Badge label={DESIGN_LABEL[project.designStage]} t={DESIGN_TONE[project.designStage]} />
            )}
          </Section>
        ) : null}

        <Section label="Team">
          {project.members.length === 0 ? (
            <Text muted>No team members yet</Text>
          ) : (
            <View style={styles.card}>
              {project.members.map((m) => {
                const role = [m.designation, project.designer?.id === m.id ? 'Project designer' : null]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <View key={m.id} style={styles.member}>
                    <Avatar name={m.name} size={32} accent={m.id === user?.id} />
                    <View style={{ flex: 1 }}>
                      <Text variant="label" color={colors.inkDeep}>
                        {m.name}
                      </Text>
                      {role ? (
                        <Text variant="caption" color={colors.inkMuted}>
                          {role}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Section>

        <Section label="Customer">
          <SheetRow
            icon="phone"
            label={`Call ${project.customer.name}`}
            caption={project.customer.phone}
            onPress={() => void openLink(telUrl(project.customer.phone))}
          />
          <SheetRow
            icon="message-circle"
            t="success"
            label="WhatsApp"
            caption="Message the customer"
            onPress={() => void openLink(whatsappUrlFor(project.customer.phone))}
          />
        </Section>

        {mapsUrl ? (
          <Section label="Location">
            <SheetRow
              icon="map-pin"
              t="info"
              label={project.siteAddress ?? ''}
              caption="Open in Maps"
              onPress={() => void Linking.openURL(mapsUrl).catch(() => undefined)}
            />
          </Section>
        ) : null}

        <Section label="Details">
          <View style={styles.card}>
            {project.value != null && !closed ? (
              <Detail label="Value" value={formatINR(project.value)} />
            ) : null}
            <Detail label="Created" value={formatDate(project.createdAt)} />
          </View>
        </Section>

        <View style={{ gap: space[2] }}>
          {perms.canSeeJourney && project.leadId ? (
            <SheetRow
              icon="git-branch"
              label="Lead journey"
              caption="See how this project started"
              onPress={() => {
                onClose();
                router.push({ pathname: '/leads/[id]', params: { id: project.leadId as string } });
              }}
            />
          ) : null}
          {perms.canInvite ? (
            <SheetRow
              icon="user-plus"
              label="Invite customer"
              caption="Share a link to this project"
              disabled={invite.isPending}
              onPress={sendInvite}
            />
          ) : null}
          {perms.isStaff && !closed ? (
            <SheetRow
              icon="check-circle"
              label="Post final delivery"
              caption="Complete project milestone with photos"
              onPress={() => {
                onClose();
                onNeedFinalDelivery();
              }}
            />
          ) : null}
          {perms.canClose && !closed ? (
            <SheetRow
              icon="archive"
              t="danger"
              label="Close project"
              caption="The customer and team will be told"
              disabled={close.isPending}
              onPress={confirmClose}
            />
          ) : null}
          {perms.canChangeStage && closed
            ? STAGE_OPTIONS.map((o) => (
                <SheetRow
                  key={o.value}
                  icon="rotate-ccw"
                  label={`Reopen as ${o.value === 'SITE' ? 'Site' : 'Design'}`}
                  disabled={stage.isPending}
                  onPress={() => stage.mutate(o.value, { onError: fail('Could not reopen') })}
                />
              ))
            : null}
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    paddingHorizontal: space[3],
    paddingVertical: space[1],
  },
  member: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[2] },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space[2],
  },
});
