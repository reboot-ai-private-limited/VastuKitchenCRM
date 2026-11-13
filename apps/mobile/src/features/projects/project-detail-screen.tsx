import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, hit, space } from '@/constants/theme';
import { ApiError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { ChatSegment } from './chat-segment';
import { InfoSheet, projectPermissions } from './info-sheet';
import { PhotoViewer, type ViewerPhoto } from './photo-viewer';
import { DESIGN_LABEL, DESIGN_TONE, STAGE_LABEL, STAGE_TONE } from './project-meta';
import { ComplaintsSegment, DocsSegment, TodosSegment } from './project-segments';
import { useProjectDetail, useScreenActive, type FeedMode } from './use-projects';

type Tab = 'chat' | 'todos' | 'complaints' | 'docs';

export function ProjectDetailScreen() {
  const {
    id,
    post,
    file,
    tab: tabParam,
  } = useLocalSearchParams<{
    id: string;
    post?: string;
    file?: string;
    tab?: string;
  }>();
  const q = useProjectDetail(id);
  const { user } = useSession();
  const screenActive = useScreenActive();

  const initialTab: Tab = file
    ? 'docs'
    : tabParam === 'todos' || tabParam === 'complaints' || tabParam === 'docs'
      ? tabParam
      : 'chat';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [mode, setMode] = useState<FeedMode>('ALL');
  const [infoOpen, setInfoOpen] = useState(false);
  const [finalRequest, setFinalRequest] = useState(0);
  const [viewer, setViewer] = useState<{ photos: ViewerPhoto[]; index: number } | null>(null);

  const openPhotos = useCallback(
    (photos: ViewerPhoto[], index: number) => setViewer({ photos, index }),
    [],
  );
  const p = q.data;

  const header = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: p?.name ?? '',
        headerShadowVisible: false,
        headerTintColor: colors.primary,
      }}
    />
  );

  if (q.isPending) {
    return (
      <View style={styles.root}>
        {header}
        <View style={{ padding: space[4], gap: space[3] }}>
          <Skeleton height={28} width="65%" />
          <Skeleton height={44} />
          <Skeleton height={140} />
        </View>
      </View>
    );
  }
  if (q.isError || !p) {
    const notFound =
      q.error instanceof ApiError && (q.error.status === 404 || q.error.status === 403);
    return (
      <View style={styles.root}>
        {header}
        <View style={{ gap: space[3], alignItems: 'center', paddingVertical: space[8] }}>
          <Text muted>
            {notFound ? "This project isn't available." : "Couldn't load this project."}
          </Text>
          {!notFound ? (
            <Button title="Try again" variant="outline" onPress={() => void q.refetch()} />
          ) : null}
        </View>
      </View>
    );
  }

  const perms = projectPermissions(p, user ? { id: user.id, role: user.role } : null);
  const tabs: { key: Tab; label: string }[] = [
    { key: 'chat', label: 'Chat' },
    ...(perms.isStaff ? [{ key: 'todos' as const, label: 'To-dos' }] : []),
    { key: 'complaints', label: 'Complaints' },
    { key: 'docs', label: 'Docs' },
  ];

  return (
    <View style={styles.root}>
      {header}
      <View style={styles.sub}>
        <View style={{ flex: 1, gap: space[1] }}>
          <Text muted numberOfLines={1}>
            {p.customer.name}
          </Text>
          <View style={{ flexDirection: 'row', gap: space[1], flexWrap: 'wrap' }}>
            <Badge label={STAGE_LABEL[p.stage]} t={STAGE_TONE[p.stage]} />
            {p.stage === 'DESIGN' ? (
              <Badge label={DESIGN_LABEL[p.designStage]} t={DESIGN_TONE[p.designStage]} />
            ) : null}
          </View>
        </View>
        {tab === 'chat' && perms.isStaff ? (
          <PressableScale
            onPress={() => {
              setMode(mode === 'CLIENT' ? 'ALL' : 'CLIENT');
              setFinalRequest(0);
            }}
            accessibilityRole="switch"
            accessibilityState={{ checked: mode === 'CLIENT' }}
            accessibilityLabel="Client view"
            hitSlop={8}
            style={[
              styles.clientToggle,
              { backgroundColor: mode === 'CLIENT' ? colors.primary : colors.muted },
            ]}
          >
            <Feather
              name="eye"
              size={14}
              color={mode === 'CLIENT' ? colors.primaryForeground : colors.mutedForeground}
            />
            <Text
              variant="caption"
              color={mode === 'CLIENT' ? colors.primaryForeground : colors.mutedForeground}
            >
              Client view
            </Text>
          </PressableScale>
        ) : null}
        <PressableScale
          onPress={() => setInfoOpen(true)}
          accessibilityLabel="Project info"
          style={styles.infoBtn}
        >
          <Feather name="info" size={22} color={colors.primary} />
        </PressableScale>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabs}
        contentContainerStyle={{ paddingHorizontal: space[3], gap: space[1] }}
      >
        {tabs.map((t) => (
          <Chip key={t.key} label={t.label} active={tab === t.key} onPress={() => setTab(t.key)} />
        ))}
      </ScrollView>

      <View style={{ flex: 1, display: tab === 'chat' ? 'flex' : 'none' }}>
        <ChatSegment
          key={mode}
          project={p}
          userId={user?.id ?? ''}
          mode={mode}
          isStaff={perms.isStaff}
          active={screenActive && tab === 'chat'}
          {...(post ? { targetPostId: post } : {})}
          finalDeliveryRequest={finalRequest}
          onOpenPhotos={openPhotos}
          onOpenDocs={() => setTab('docs')}
        />
      </View>
      {tab === 'todos' && perms.isStaff ? <TodosSegment project={p} /> : null}
      {tab === 'complaints' ? <ComplaintsSegment project={p} active={screenActive} /> : null}
      {tab === 'docs' ? (
        <DocsSegment
          project={p}
          {...(file ? { targetFileId: file } : {})}
          onOpenPhotos={openPhotos}
        />
      ) : null}

      <InfoSheet
        project={p}
        user={user ? { id: user.id, role: user.role } : null}
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
        onNeedFinalDelivery={() => {
          setTab('chat');
          setMode('ALL');
          setFinalRequest((n) => n + 1);
        }}
      />
      {viewer ? (
        <PhotoViewer
          photos={viewer.photos}
          startIndex={viewer.index}
          onClose={() => setViewer(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  sub: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[4], gap: space[2] },
  infoBtn: { width: hit, height: hit, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexGrow: 0 },
  clientToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
  },
});
