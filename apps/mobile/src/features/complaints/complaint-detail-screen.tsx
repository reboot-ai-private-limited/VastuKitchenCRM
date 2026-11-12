import { useEffect, useState } from 'react';
import { Keyboard, ScrollView, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, font, radius, space } from '@/constants/theme';
import { ApiError, NetworkError } from '@/lib/api/client';
import { timeAgo } from '@/lib/format';
import { STATUS_LABEL, STATUS_TONE } from './complaint-meta';
import { useComplaintAction, useComplaintDetail, type ComplaintAction } from './use-complaints';

const ACTION_LABEL: Record<ComplaintAction, string> = {
  comment: 'Send',
  resolve: 'Mark resolved',
  reopen: 'Reopen',
  close: 'Close complaint',
};
const ACTION_HINT: Record<ComplaintAction, string> = {
  comment: 'Write a message',
  resolve: 'What was done to fix it? (required)',
  reopen: 'Why is it being reopened? (required)',
  close: 'Closing note (optional)',
};

export function ComplaintDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const q = useComplaintDetail(id);
  const act = useComplaintAction(id);
  const [mode, setMode] = useState<ComplaintAction>('comment');
  const [text, setText] = useState('');
  const c = q.data;
  const [kbOpen, setKbOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKbOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const submit = () => {
    const value = text.trim();
    if (!value && mode !== 'close') return;
    act.mutate(
      { action: mode, text: value },
      {
        onSuccess: () => {
          setText('');
          setMode('comment');
        },
      },
    );
  };

  const errorText = act.error
    ? act.error instanceof NetworkError
      ? 'Connection lost. Check your internet and try again.'
      : act.error instanceof ApiError && act.error.status === 409
        ? 'Someone else just updated this. It has been refreshed.'
        : act.error.message
    : null;

  let content;
  if (q.isPending) {
    content = (
      <View style={{ gap: space[3] }}>
        <Skeleton height={28} width="60%" />
        <Skeleton height={120} />
      </View>
    );
  } else if (q.isError || !c) {
    const notFound = q.error instanceof ApiError && (q.error.status === 404 || q.error.status === 403);
    content = (
      <View style={{ gap: space[3], alignItems: 'center', paddingVertical: space[8] }}>
        <Text muted>{notFound ? 'This complaint could not be found.' : 'Could not load this complaint.'}</Text>
        {!notFound ? <Button title="Retry" variant="outline" onPress={() => void q.refetch()} /> : null}
      </View>
    );
  } else {
    const actions = (['resolve', 'reopen', 'close'] as const).filter((a) => c.can[a]);
    content = (
      <Reveal style={{ gap: space[5] }}>
        <View style={{ gap: space[2] }}>
          <Text variant="title">{c.projectName}</Text>
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <Badge label={STATUS_LABEL[c.status]} t={STATUS_TONE[c.status]} />
            {c.reopenCount > 0 ? <Badge label={`Reopened ${c.reopenCount}x`} t="orange" /> : null}
          </View>
          <Text variant="caption" muted>
            {c.customer.name} · raised {timeAgo(c.createdAt)}
            {c.assignedTo ? ` · assigned to ${c.assignedTo.name}` : ''}
          </Text>
        </View>

        <Card style={{ gap: space[2] }}>
          <Text>{c.description}</Text>
          <Photos images={c.images} />
        </Card>

        {c.resolutionNote ? (
          <Card style={{ gap: space[2] }}>
            <Text variant="caption" muted>
              Resolution
            </Text>
            <Text>{c.resolutionNote}</Text>
            <Photos images={c.resolutionImages} />
          </Card>
        ) : null}

        {actions.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            {actions.map((a) => (
              <Button
                key={a}
                title={ACTION_LABEL[a]}
                size="sm"
                variant={mode === a ? 'default' : 'outline'}
                onPress={() => setMode(mode === a ? 'comment' : a)}
              />
            ))}
          </View>
        ) : null}

        <View style={{ gap: space[3] }}>
          <Text variant="section">Conversation</Text>
          {c.comments.length === 0 ? <Text muted>No messages yet.</Text> : null}
          {c.comments.map((m) => (
            <Card key={m.id} style={{ gap: space[1] }}>
              <View style={{ flexDirection: 'row', gap: space[2] }}>
                <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>
                  {m.author.name}
                </Text>
                <Text variant="caption" muted>
                  {timeAgo(m.createdAt)}
                </Text>
              </View>
              {m.text ? <Text>{m.text}</Text> : null}
              <Photos images={m.images} />
            </Card>
          ))}
        </View>

        <View style={{ gap: space[3] }}>
          <Text variant="section">History</Text>
          {c.history.map((h, i) => (
            <Text key={i} variant="caption" muted>
              {h.type.toLowerCase()} · {h.actor?.name ?? 'System'} · {timeAgo(h.at)}
              {h.note ? ` · ${h.note}` : ''}
            </Text>
          ))}
        </View>
      </Reveal>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: '', headerShadowVisible: false, headerTintColor: colors.primary }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior="padding"
      >
        <ScrollView
          contentContainerStyle={{ padding: space[4], paddingTop: space[1], paddingBottom: space[6], gap: space[5] }}
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>
        {c ? (
          <View
            style={{
              padding: space[3],
              paddingBottom: (kbOpen ? 0 : insets.bottom) + space[3],
              gap: space[2],
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            {errorText ? (
              <Text variant="caption" color={colors.destructive}>
                {errorText}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'flex-end' }}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={ACTION_HINT[mode]}
                placeholderTextColor={colors.placeholder}
                multiline
                style={{
                  flex: 1,
                  minHeight: 44,
                  maxHeight: 120,
                  paddingHorizontal: space[3],
                  paddingVertical: space[2],
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.input,
                  fontFamily: font.regular,
                  fontSize: 16,
                  color: colors.foreground,
                }}
              />
              <Button
                title={mode === 'comment' ? 'Send' : 'Submit'}
                loading={act.isPending}
                disabled={mode !== 'close' && !text.trim()}
                onPress={submit}
              />
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </>
  );
}

function Photos({ images }: { images: { publicId: string; thumbUrl: string }[] }) {
  if (images.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[1] }}>
      {images.slice(0, 6).map((img) => (
        <Image
          key={img.publicId}
          source={{ uri: img.thumbUrl }}
          style={{ width: '32%', aspectRatio: 1, borderRadius: radius.md, backgroundColor: colors.muted }}
          contentFit="cover"
        />
      ))}
    </View>
  );
}
