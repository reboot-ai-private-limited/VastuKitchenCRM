import { useCallback, useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, space } from '@/constants/theme';
import { ApiError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { softTick } from '@/lib/haptics';
import { ChatSegment } from './chat-segment';
import { DetailHeader, headerButton, headerMutedText } from './detail-header';
import { InfoSheet, projectPermissions } from './info-sheet';
import { PhotoViewer, type ViewerPhoto } from './photo-viewer';
import { DESIGN_SUB_LABEL, STAGE_LABEL, STAGE_TONE } from './project-meta';
import { ComplaintsSegment, DocsSegment, TodosSegment } from './project-segments';
import { SheetRow } from './sheet-row';
import { useProjectDetail, useScreenActive, type FeedMode } from './use-projects';

type Tab = 'chat' | 'todos' | 'complaints' | 'docs';
const TAB_META = {
  chat: { label: 'Chat', icon: 'message-circle' },
  todos: { label: 'To-dos', icon: 'check-square' },
  complaints: { label: 'Complaints', icon: 'life-buoy' },
  docs: { label: 'Docs', icon: 'folder' },
} as const;

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
  const router = useRouter();
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [finalRequest, setFinalRequest] = useState(0);
  const [viewer, setViewer] = useState<{ photos: ViewerPhoto[]; index: number } | null>(null);

  const openPhotos = useCallback(
    (photos: ViewerPhoto[], index: number) => setViewer({ photos, index }),
    [],
  );

  const handleBack = useCallback(() => {
    if (tab !== 'chat') {
      setTab('chat');
      return;
    }
    router.back();
  }, [tab, router]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (tab !== 'chat') {
        setTab('chat');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [tab]);

  const p = q.data;

  const stackScreen = <Stack.Screen options={{ headerShown: false }} />;

  const topBar = (
    <DetailHeader
      title={p?.name ?? ''}
      onBack={handleBack}
      backLabel={tab !== 'chat' ? 'Back to chat' : 'Go back'}
      right={
        p ? (
          <View style={styles.headerActions}>
            <PressableScale
              onPress={() => {
                softTick();
                setInfoOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Project info"
              hitSlop={8}
              style={headerButton}
            >
              <Feather name="info" size={21} color={colors.primaryForeground} />
            </PressableScale>
            <PressableScale
              onPress={() => {
                softTick();
                setMenuOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Project menu"
              hitSlop={8}
              style={headerButton}
            >
              <Feather name="more-vertical" size={21} color={colors.primaryForeground} />
            </PressableScale>
          </View>
        ) : undefined
      }
    >
      {p ? (
        <>
          <Text
            variant="caption"
            color={headerMutedText}
            numberOfLines={1}
            style={styles.customerName}
          >
            {/* Away from the chat, say which page this is. */}
            {tab === 'chat' ? '' : `${TAB_META[tab].label} · `}
            {p.customer.name}
          </Text>
          <View style={styles.stageWrap}>
            <Badge label={STAGE_LABEL[p.stage]} t={STAGE_TONE[p.stage]} />
            {p.stage === 'DESIGN' ? (
              <Text variant="caption" color={headerMutedText} numberOfLines={1}>
                {DESIGN_SUB_LABEL[p.designStage]}
              </Text>
            ) : null}
          </View>
        </>
      ) : null}
    </DetailHeader>
  );

  if (q.isPending) {
    return (
      <View style={styles.root}>
        {stackScreen}
        {topBar}
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
        {stackScreen}
        {topBar}
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
  const tabs: Tab[] = ['chat', ...(perms.isStaff ? ['todos' as const] : []), 'complaints', 'docs'];

  return (
    <View style={styles.root}>
      {stackScreen}
      {topBar}

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title="Project">
        <View style={{ gap: 2 }}>
          {tabs.map((key) => (
            <SheetRow
              key={key}
              icon={TAB_META[key].icon}
              label={TAB_META[key].label}
              selected={tab === key}
              onPress={() => {
                softTick();
                setTab(key);
                setMenuOpen(false);
              }}
            />
          ))}
        </View>

        <View style={styles.menuDivider} />

        <View style={{ gap: 2 }}>
          <SheetRow
            icon="info"
            label="Project info"
            showChevron
            onPress={() => {
              setMenuOpen(false);
              setInfoOpen(true);
            }}
          />

          {perms.isStaff ? (
            <SheetRow
              icon="eye"
              label={mode === 'CLIENT' ? 'Exit client preview' : 'Preview as client'}
              onPress={() => {
                setMenuOpen(false);
                setTab('chat');
                setMode(mode === 'CLIENT' ? 'ALL' : 'CLIENT');
                setFinalRequest(0);
              }}
            />
          ) : null}

          {perms.isStaff && p.stage !== 'CLOSED' ? (
            <SheetRow
              icon="check-circle"
              label="Post final delivery"
              onPress={() => {
                setMenuOpen(false);
                setTab('chat');
                setMode('ALL');
                setFinalRequest((n) => n + 1);
              }}
            />
          ) : null}
        </View>
      </BottomSheet>

      <View style={{ flex: 1, display: tab === 'chat' ? 'flex' : 'none' }}>
        <ChatSegment
          project={p}
          userId={user?.id ?? ''}
          mode={mode}
          onChangeMode={(next) => {
            setMode(next);
            setFinalRequest(0);
          }}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerName: {
    fontSize: 13,
    flexShrink: 1,
  },
  stageWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    flexShrink: 0,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: space[2],
  },
});
