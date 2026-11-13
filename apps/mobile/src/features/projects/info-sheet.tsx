import type React from 'react';
import { Alert, Linking, Share, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { DesignStage, ProjectDto, RoleName } from '@vastu/contracts';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { space } from '@/constants/theme';
import { ApiError } from '@/lib/api/client';
import { formatDate, formatINR } from '@/lib/format';
import { openLink, telUrl, whatsappUrlFor } from '@/lib/phone';
import { DESIGN_LABEL, STAGE_LABEL, STAGE_TONE } from './project-meta';
import { useChangeDesignStage, useChangeStage, useCloseProject, useInviteCustomer } from './use-projects';

const DESIGN_ORDER: DesignStage[] = ['NOT_STARTED', 'IN_DESIGN', 'SHARED', 'APPROVED'];

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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 2 }}>
      <Text variant="caption" muted>
        {label}
      </Text>
      {children}
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
        <Row label="Stage">
          {perms.canChangeStage && !closed ? (
            <View style={{ flexDirection: 'row', gap: space[1] }}>
              {(['DESIGN', 'SITE'] as const).map((s) => (
                <Chip
                  key={s}
                  label={STAGE_LABEL[s]}
                  active={project.stage === s}
                  onPress={() => project.stage !== s && stage.mutate(s, { onError: fail('Could not change the stage') })}
                />
              ))}
            </View>
          ) : (
            <Badge label={closed ? `Closed${project.closedAt ? ` ${formatDate(project.closedAt)}` : ''}` : STAGE_LABEL[project.stage]} t={STAGE_TONE[project.stage]} />
          )}
        </Row>

        {!closed ? (
          <Row label="Design stage">
            {perms.canChangeDesignStage ? (
              <View style={{ flexDirection: 'row', gap: space[1], flexWrap: 'wrap' }}>
                {DESIGN_ORDER.map((d) => (
                  <Chip
                    key={d}
                    label={DESIGN_LABEL[d]}
                    active={project.designStage === d}
                    onPress={() =>
                      project.designStage !== d && design.mutate(d, { onError: fail('Could not change the design stage') })
                    }
                  />
                ))}
              </View>
            ) : (
              <Text>{DESIGN_LABEL[project.designStage]}</Text>
            )}
          </Row>
        ) : null}

        <Row label="Team">
          {project.members.length === 0 ? (
            <Text muted>No team members yet</Text>
          ) : (
            project.members.map((m) => (
              <Text key={m.id}>
                {m.name}
                {m.designation ? ` · ${m.designation}` : ''}
                {project.designer?.id === m.id ? '  (Designer)' : ''}
              </Text>
            ))
          )}
        </Row>

        <Row label="Customer">
          <Text>{project.customer.name}</Text>
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <Button title="Call" size="sm" variant="outline" onPress={() => void openLink(telUrl(project.customer.phone))} />
            <Button
              title="WhatsApp"
              size="sm"
              variant="outline"
              onPress={() => void openLink(whatsappUrlFor(project.customer.phone))}
            />
          </View>
        </Row>

        {project.siteAddress ? (
          <Row label="Site address">
            <Text>{project.siteAddress}</Text>
            {mapsUrl ? (
              <Button title="Open in Maps" size="sm" variant="outline" onPress={() => void Linking.openURL(mapsUrl).catch(() => undefined)} />
            ) : null}
          </Row>
        ) : null}

        {project.value != null && !closed ? (
          <Row label="Value">
            <Text>{formatINR(project.value)}</Text>
          </Row>
        ) : null}
        <Row label="Created">
          <Text>{formatDate(project.createdAt)}</Text>
        </Row>

        <View style={{ gap: space[2] }}>
          {perms.canSeeJourney && project.leadId ? (
            <Button
              title="Lead journey"
              variant="outline"
              fullWidth
              onPress={() => {
                onClose();
                router.push({ pathname: '/leads/[id]', params: { id: project.leadId as string } });
              }}
            />
          ) : null}
          {perms.canInvite ? (
            <Button title="Invite customer" variant="outline" fullWidth loading={invite.isPending} onPress={sendInvite} />
          ) : null}
          {perms.canClose && !closed ? (
            <Button title="Close project" variant="destructive" fullWidth loading={close.isPending} onPress={confirmClose} />
          ) : null}
          {perms.canChangeStage && closed ? (
            <>
              <Button
                title="Reopen as Design"
                variant="outline"
                fullWidth
                loading={stage.isPending}
                onPress={() => stage.mutate('DESIGN', { onError: fail('Could not reopen') })}
              />
              <Button
                title="Reopen as Site"
                variant="outline"
                fullWidth
                loading={stage.isPending}
                onPress={() => stage.mutate('SITE', { onError: fail('Could not reopen') })}
              />
            </>
          ) : null}
        </View>
      </View>
    </BottomSheet>
  );
}

