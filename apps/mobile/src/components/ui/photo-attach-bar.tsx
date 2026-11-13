import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { colors, hit, radius, space } from '@/constants/theme';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

type Item = {
  key: string;
  image: { uri: string };
  status: 'uploading' | 'done' | 'error';
  error?: string;
};

type Props = {
  items: Item[];
  problem: string | null;
  onCamera: () => void;
  onGallery: () => void;
  onRemove: (key: string) => void;
  onRetry: (key: string) => void;
  disabled?: boolean;
  /** Only the strip of chosen photos: the caller shows its own camera/gallery icons (e.g. in a chat composer). */
  hideActions?: boolean;
};

/** Camera/gallery buttons plus a strip of the chosen photos with remove/retry. Pairs with useSignedAttachments. */
export function PhotoAttachBar({ items, problem, onCamera, onGallery, onRemove, onRetry, disabled, hideActions }: Props) {
  return (
    <View style={{ gap: space[2] }}>
      <View style={{ flexDirection: 'row', gap: space[2], display: hideActions ? 'none' : 'flex' }}>
        <PressableScale
          onPress={onCamera}
          disabled={disabled}
          accessibilityLabel="Take a photo"
          style={styles.action}
        >
          <Feather name="camera" size={20} color={colors.primary} />
        </PressableScale>
        <PressableScale
          onPress={onGallery}
          disabled={disabled}
          accessibilityLabel="Choose photos from gallery"
          style={styles.action}
        >
          <Feather name="image" size={20} color={colors.primary} />
        </PressableScale>
      </View>
      {items.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2] }}>
          {items.map((a, i) => (
            <View key={a.key} style={styles.thumbWrap}>
              <Image
                source={{ uri: a.image.uri }}
                style={styles.thumb}
                contentFit="cover"
                accessibilityLabel={`Attached photo ${i + 1}, ${a.status === 'done' ? 'uploaded' : a.status === 'error' ? 'upload failed' : 'uploading'}`}
              />
              {a.status === 'uploading' ? (
                <View style={styles.overlay}>
                  <ActivityIndicator color={colors.primaryForeground} />
                </View>
              ) : null}
              {a.status === 'error' ? (
                <PressableScale
                  onPress={() => onRetry(a.key)}
                  accessibilityLabel={`Retry upload of photo ${i + 1}`}
                  style={[styles.overlay, { backgroundColor: 'rgba(192,57,43,0.7)' }]}
                >
                  <Feather name="refresh-cw" size={18} color={colors.primaryForeground} />
                </PressableScale>
              ) : null}
              <PressableScale
                onPress={() => onRemove(a.key)}
                accessibilityLabel={`Remove photo ${i + 1}`}
                style={styles.remove}
              >
                <View style={styles.removeDot}>
                  <Feather name="x" size={12} color={colors.primaryForeground} />
                </View>
              </PressableScale>
            </View>
          ))}
        </ScrollView>
      ) : null}
      {problem ? (
        <Text variant="caption" color={colors.destructive}>
          {problem}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    width: hit,
    height: hit,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbWrap: { width: 64, height: 64 },
  thumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.muted },
  overlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  remove: { position: 'absolute', top: -14, right: -14, width: hit, height: hit, alignItems: 'center', justifyContent: 'center' },
  removeDot: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.foreground,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
