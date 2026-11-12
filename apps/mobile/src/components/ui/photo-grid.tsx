import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { colors, hit, radius, space } from '@/constants/theme';
import { PressableScale } from './pressable-scale';

type Img = { publicId: string; url: string; thumbUrl: string };

/** Thumbnails that open full-size in a viewer. `label` names the group for screen readers. */
export function PhotoGrid({ images, label = 'Photo' }: { images: Img[]; label?: string }) {
  const [open, setOpen] = useState<Img | null>(null);
  if (images.length === 0) return null;
  return (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[1] }}>
        {images.slice(0, 6).map((img, i) => (
          <PressableScale
            key={img.publicId}
            onPress={() => setOpen(img)}
            accessibilityLabel={`${label} ${i + 1} of ${images.length}, open full size`}
            style={{ width: '32%', aspectRatio: 1 }}
          >
            <Image
              source={{ uri: img.thumbUrl }}
              style={{ flex: 1, borderRadius: radius.md, backgroundColor: colors.muted }}
              contentFit="cover"
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
