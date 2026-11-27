import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { colors, hit, radius, space } from '@/constants/theme';
import { PressableScale } from './pressable-scale';

type Img = {
  publicId: string;
  url: string;
  thumbUrl: string;
  width?: number | null;
  height?: number | null;
};

function ratioOf(img: Img): number {
  if (!img.width || !img.height) return 4 / 3;
  return Math.min(2, Math.max(0.5, img.width / img.height));
}

/** Big proportional thumbnails (full-width for 1 photo, 2-column grid for multiple) that open full-size in a viewer. */
export function PhotoGrid({ images, label = 'Photo' }: { images: Img[]; label?: string }) {
  const [open, setOpen] = useState<Img | null>(null);
  if (images.length === 0) return null;
  const shown = images.slice(0, 6);
  const single = shown.length === 1;
  return (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
        {shown.map((img, i) => (
          <PressableScale
            key={img.publicId}
            onPress={() => setOpen(img)}
            accessibilityLabel={`${label} ${i + 1} of ${images.length}, open full size`}
            style={{
              width: single ? '100%' : '49%',
              aspectRatio: single ? ratioOf(img) : 1,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              overflow: 'hidden',
              backgroundColor: colors.muted,
            }}
          >
            <Image
              source={{ uri: single ? img.url : img.thumbUrl }}
              style={{ flex: 1 }}
              contentFit={single ? 'contain' : 'cover'}
              accessible={false}
            />
          </PressableScale>
        ))}
      </View>
      <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => setOpen(null)} statusBarTranslucent>
        <View style={styles.backdrop} accessibilityViewIsModal>
          {open ? (
            <Image source={{ uri: open.url }} style={StyleSheet.absoluteFill} contentFit="contain" accessibilityLabel={label} />
          ) : null}
          <Pressable
            onPress={() => setOpen(null)}
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            style={styles.close}
          >
            <Feather name="x" size={24} color={colors.primaryForeground} />
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  close: {
    position: 'absolute',
    top: 48,
    right: space[3],
    width: hit,
    height: hit,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
});
