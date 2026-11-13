import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, space } from '@/constants/theme';
import { ChatSegment } from '@/features/projects/chat-segment';
import { PhotoViewer, type ViewerPhoto } from '@/features/projects/photo-viewer';
import { useScreenActive } from '@/features/projects/use-projects';
import { NetworkError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { CustomerHeader, useActiveCustomerProject } from './customer-shell-shared';

/**
 * The customer's project tab. The conversation is the very same chat the team uses (bubbles, replies,
 * photos, Approve design), showing the client side only; the customer can post and reply.
 */
export function CustomerProjectScreen() {
  const params = useLocalSearchParams<{ projectId?: string; post?: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useSession();
  const screenActive = useScreenActive();
  const {
    projects,
    project,
    setProjectId,
    isPending,
    isError,
    error,
    refetch,
  } = useActiveCustomerProject(params.projectId);

  const [viewer, setViewer] = useState<{ photos: ViewerPhoto[]; index: number } | null>(null);
  const openPhotos = useCallback(
    (photos: ViewerPhoto[], index: number) => setViewer({ photos, index }),
    [],
  );

  return (
    <View style={styles.root}>
      <View style={{ paddingTop: insets.top + space[2], paddingHorizontal: space[4], paddingBottom: space[2] }}>
        <CustomerHeader project={project} projects={projects} onSelectProject={setProjectId} />
      </View>

      {isPending ? (
        <View style={{ gap: space[3], padding: space[4] }}>
          <Skeleton height={90} />
          <Skeleton height={140} />
        </View>
      ) : isError ? (
        <View style={{ padding: space[4] }}>
          <Card style={{ alignItems: 'center', gap: space[3], paddingVertical: space[6] }}>
            <Text muted style={{ textAlign: 'center' }}>
              {error instanceof NetworkError
                ? 'Connection lost. Check your internet and try again.'
                : (error?.message ?? 'Could not load your project.')}
            </Text>
            <Button title="Retry" variant="outline" onPress={() => void refetch()} />
          </Card>
        </View>
      ) : !project ? (
        <View style={{ padding: space[4] }}>
          <EmptyState
            icon="home"
            message="Your kitchen workspace is being set up. You will see updates here as soon as your project starts."
          />
        </View>
      ) : (
        <ChatSegment
          key={project.id}
          project={project}
          userId={user?.id ?? ''}
          mode="CLIENT"
          isStaff={false}
          isCustomer
          active={screenActive}
          {...(params.post ? { targetPostId: params.post } : {})}
          finalDeliveryRequest={0}
          onOpenPhotos={openPhotos}
          onOpenDocs={() => router.push('/docs' as Href)}
        />
      )}

      {viewer ? (
        <PhotoViewer photos={viewer.photos} startIndex={viewer.index} onClose={() => setViewer(null)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
