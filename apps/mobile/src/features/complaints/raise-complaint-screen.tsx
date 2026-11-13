import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useCallback, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { MAX_COMPLAINT_IMAGES, raiseComplaintBodySchema } from '@vastu/contracts';
import { Button } from '@/components/ui/button';
import { PhotoAttachBar } from '@/components/ui/photo-attach-bar';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, font, hit, radius, space } from '@/constants/theme';
import { ApiError, NetworkError } from '@/lib/api/client';
import { signRaiseUpload } from '@/lib/api/endpoints/complaints';
import { listProjects } from '@/lib/api/endpoints/projects';
import { useSignedAttachments } from './use-signed-attachments';
import { useRaiseComplaint } from './use-complaints';

export function RaiseComplaintScreen() {
  const { projectId: initialProjectId } = useLocalSearchParams<{ projectId?: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const raise = useRaiseComplaint();

  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId ?? '');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const projectsQ = useQuery({
    queryKey: ['projects', 'raise-complaint-options'],
    queryFn: ({ signal }) => listProjects({ page: 1, pageSize: 50 }, signal),
    select: (d) => d.items.filter((p) => p.stage !== 'CLOSED'),
  });

  const effectiveProjectId =
    selectedProjectId || (projectsQ.data?.length === 1 ? projectsQ.data[0].id : '');

  const sign = useCallback(() => signRaiseUpload(effectiveProjectId), [effectiveProjectId]);
  const photos = useSignedAttachments(sign, MAX_COMPLAINT_IMAGES);

  const submit = () => {
    if (photos.busy || !photos.uploadsDone) {
      setError('Wait for the photos to finish uploading, or remove any that failed.');
      return;
    }
    const parsed = raiseComplaintBodySchema.safeParse({
      projectId: effectiveProjectId,
      description,
      images: photos.images.length ? photos.images : undefined,
    });
    if (!parsed.success) {
      setError(
        !effectiveProjectId
          ? 'Select a project first'
          : (parsed.error.issues[0]?.message ?? 'Describe the issue'),
      );
      return;
    }
    setError(null);
    raise.mutate(parsed.data, {
      onSuccess: (complaint) => {
        router.replace({ pathname: '/complaints/[id]', params: { id: complaint.id } } as Href);
      },
      onError: (err) => {
        setError(
          err instanceof NetworkError
            ? 'Connection lost. Check your internet and try again.'
            : err instanceof ApiError
              ? err.message
              : 'Could not submit complaint',
        );
      },
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior="padding"
      keyboardVerticalOffset={88}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Raise complaint',
          headerShadowVisible: false,
          headerTintColor: colors.primary,
        }}
      />
      <ScrollView
        contentContainerStyle={{
          padding: space[4],
          paddingBottom: insets.bottom + space[8],
          gap: space[4],
        }}
        keyboardShouldPersistTaps="handled"
      >
        {projectsQ.isPending ? (
          <Skeleton height={120} />
        ) : (projectsQ.data ?? []).length === 0 ? (
          <EmptyState
            icon="alert-circle"
            message="Complaints can only be raised on active projects."
          />
        ) : (
          <>
            <Card style={{ gap: space[3] }}>
              <View style={{ gap: space[2] }}>
                <Text variant="caption" muted>
                  Project *
                </Text>
                <View style={{ gap: space[2] }}>
                  {(projectsQ.data ?? []).map((p) => {
                    const selected = p.id === effectiveProjectId;
                    return (
                      <PressableScale
                        key={p.id}
                        accessibilityLabel={`${p.name}, ${p.customer.name}`}
                        accessibilityState={{ selected }}
                        onPress={() => setSelectedProjectId(p.id)}
                        style={[
                          styles.projectOption,
                          selected && {
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
                            {p.customer.name}
                          </Text>
                        </View>
                        {selected ? (
                          <Feather name="check-circle" size={18} color={colors.primary} />
                        ) : null}
                      </PressableScale>
                    );
                  })}
                </View>
              </View>

              <View style={{ gap: space[1] }}>
                <Text variant="caption" muted>
                  What needs attention? *
                </Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Describe the fitting, hinge, finish or service issue..."
                  placeholderTextColor={colors.placeholder}
                  multiline
                  accessibilityLabel="Describe the issue"
                  style={styles.textarea}
                />
              </View>
              <View style={{ gap: space[1] }}>
                <Text variant="caption" muted>
                  Photos (optional)
                </Text>
                <PhotoAttachBar
                  items={photos.items}
                  problem={photos.problem}
                  disabled={!effectiveProjectId}
                  onCamera={() => void photos.takePhoto()}
                  onGallery={() => void photos.pickFromGallery()}
                  onRemove={photos.remove}
                  onRetry={photos.retry}
                />
              </View>
            </Card>

            {error ? (
              <Text variant="caption" color={colors.destructive}>
                {error}
              </Text>
            ) : null}

            <Button
              title="Submit complaint"
              size="lg"
              loading={raise.isPending}
              disabled={photos.busy}
              onPress={submit}
              fullWidth
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  projectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    minHeight: hit,
    padding: space[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  textarea: {
    minHeight: 120,
    paddingHorizontal: space[3],
    paddingVertical: space[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.background,
    fontFamily: font.regular,
    fontSize: 16,
    color: colors.foreground,
    textAlignVertical: 'top',
  },
});
