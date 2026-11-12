import { useRef, useState } from 'react';
import { FlatList, Modal, Platform, ScrollView, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, hit, radius, space } from '@/constants/theme';

export type ViewerPhoto = { publicId: string; url: string; thumbUrl: string };

type Props = { photos: ViewerPhoto[]; startIndex: number; onClose: () => void };

/** Full-screen photo pager: swipe between photos, pinch to zoom (iOS), share, close. */
export function PhotoViewer({ photos, startIndex, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(startIndex);
  const listRef = useRef<FlatList<ViewerPhoto>>(null);
  const visible = photos.length > 0;

  const share = () => {
    const url = photos[index]?.url;
    if (!url) return;
    void Share.share(Platform.OS === 'ios' ? { url } : { message: url }).catch(() => undefined);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop} accessibilityViewIsModal>
        {visible ? (
          <FlatList
            ref={listRef}
            data={photos}
            horizontal
            pagingEnabled
            keyExtractor={(p) => p.publicId}
            initialScrollIndex={Math.min(startIndex, photos.length - 1)}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item }) => (
              <ScrollView
                style={{ width, height }}
                contentContainerStyle={{ width, height, justifyContent: 'center' }}
                maximumZoomScale={4}
                minimumZoomScale={1}
                centerContent
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
              >
                <Image
                  source={{ uri: item.url }}
                  placeholder={{ uri: item.thumbUrl }}
                  style={{ width, height: height * 0.8 }}
                  contentFit="contain"
                  accessibilityLabel="Photo"
                />
              </ScrollView>
            )}
          />
        ) : null}
        <View style={[styles.bar, { top: insets.top + space[2] }]}>
          <Text variant="caption" color={colors.primaryForeground}>
            {photos.length > 1 ? `${index + 1} / ${photos.length}` : ''}
          </Text>
          <View style={{ flex: 1 }} />
          <PressableScale onPress={share} accessibilityLabel="Share photo" style={styles.btn}>
            <Feather name="share-2" size={20} color={colors.primaryForeground} />
          </PressableScale>
          <PressableScale onPress={onClose} accessibilityLabel="Close photo" style={styles.btn}>
            <Feather name="x" size={24} color={colors.primaryForeground} />
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  bar: { position: 'absolute', left: space[3], right: space[3], flexDirection: 'row', alignItems: 'center', gap: space[2] },
  btn: {
    width: hit,
    height: hit,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
});
