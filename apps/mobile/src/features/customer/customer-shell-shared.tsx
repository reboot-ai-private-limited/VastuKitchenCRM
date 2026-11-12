import { useEffect, useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { ProjectDto } from '@vastu/contracts';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { IconButton } from '@/components/ui/icon-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, radius, space } from '@/constants/theme';
import { useUnreadCount } from '@/features/alerts/use-notifications';
import { DESIGN_LABEL, STAGE_LABEL, STAGE_TONE } from '@/features/projects/project-meta';
import { listProjects } from '@/lib/api/endpoints/projects';
import { useSession } from '@/lib/auth/session';

let currentProjectId: string | null = null;
const listeners = new Set<() => void>();

function setSelectedProjectId(id: string) {
  if (currentProjectId !== id) {
    currentProjectId = id;
    listeners.forEach((l) => l());
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useActiveCustomerProject(overrideProjectId?: string) {
  const storedId = useSyncExternalStore(
    subscribe,
    () => currentProjectId,
    () => currentProjectId,
  );

  const q = useQuery({
    queryKey: ['customer', 'projects'],
    queryFn: ({ signal }) => listProjects({ page: 1, pageSize: 100 }, signal),
    select: (d) => d.items,
  });

  useEffect(() => {
    if (overrideProjectId) {
      setSelectedProjectId(overrideProjectId);
    }
  }, [overrideProjectId]);

  const projects = q.data ?? [];
  const preferredDefault = projects.find((p) => p.stage !== 'CLOSED') ?? projects[0] ?? null;
  const activeId = overrideProjectId ?? storedId ?? preferredDefault?.id ?? null;
  const project = projects.find((p) => p.id === activeId) ?? preferredDefault;

  return {
    projects,
    project,
    setProjectId: setSelectedProjectId,
    isPending: q.isPending,
    isError: q.isError,
    error: q.error,
    isRefetching: q.isRefetching,
    refetch: q.refetch,
  };
}

export function CustomerHeader({
  project,
  projects,
  onSelectProject,
}: {
  project: ProjectDto | null;
  projects: ProjectDto[];
  onSelectProject: (id: string) => void;
}) {
  const router = useRouter();
  const { user } = useSession();
  const unread = useUnreadCount().data ?? 0;
  const [pickerOpen, setPickerOpen] = useState(false);

  const subtitle = project
    ? project.stage === 'DESIGN'
      ? `${STAGE_LABEL[project.stage]} · ${DESIGN_LABEL[project.designStage]}`
      : STAGE_LABEL[project.stage]
    : 'Your kitchen workspace';

  return (
    <>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 2 }}>
          {projects.length > 1 && project ? (
            <PressableScale
              onPress={() => setPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Switch project"
              style={styles.switcherBtn}
            >
              <Text variant="title" numberOfLines={1} style={{ flexShrink: 1 }}>
                {project.name}
              </Text>
              <View style={styles.switcherChevron}>
                <Feather name="chevron-down" size={16} color={colors.primary} />
              </View>
            </PressableScale>
          ) : (
            <Text variant="title" numberOfLines={1}>
              {project?.name ?? 'Vastu Kitchen'}
            </Text>
          )}
          <Text variant="caption" muted numberOfLines={1}>
            {subtitle}
          </Text>
        </View>

        <IconButton
          icon="bell"
          badge={unread}
          label="Open notifications"
          onPress={() => router.push('/notifications' as Href)}
        />
        {user ? (
          <Avatar name={user.name} size={36} accent onPress={() => router.push('/profile' as Href)} />
        ) : null}
      </View>

      <BottomSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Your projects"
        subtitle="Switch between your Vastu Kitchen projects"
      >
        <View style={{ gap: space[2] }}>
          {projects.map((p) => {
            const active = p.id === project?.id;
            return (
              <PressableScale
                key={p.id}
                onPress={() => {
                  onSelectProject(p.id);
                  setPickerOpen(false);
                }}
                style={[
                  styles.projectItem,
                  active && {
                    borderColor: colors.primary,
                    backgroundColor: colors.primarySoft,
                  },
                ]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="label" numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text variant="caption" muted numberOfLines={1}>
                    {p.siteAddress ?? p.customer.name}
                  </Text>
                </View>
                <Badge label={STAGE_LABEL[p.stage]} t={STAGE_TONE[p.stage]} />
                {active ? <Feather name="check" size={18} color={colors.primary} /> : null}
              </PressableScale>
            );
          })}
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
  },
  switcherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    alignSelf: 'flex-start',
  },
  switcherChevron: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    padding: space[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
});
