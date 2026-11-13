import { useCallback, useState } from 'react';
import type { CreatePostBodyDto } from '@vastu/contracts';
import { useCreatePost } from './use-projects';

export type PendingPost = { key: string; body: CreatePostBodyDto; status: 'sending' | 'failed' };

/**
 * The one place a chat post is sent from the screen. `send(body)` shows the post as "Sending..." and
 * posts it; failures stay on screen with Retry / Discard.
 *
 * TODO(outbox): replace `createPost.mutateAsync` (in useCreatePost) with an outbox enqueue; the screen
 * only depends on `pending`, `send`, `retry` and `discard`.
 */
export function usePostSender(projectId: string) {
  const createPost = useCreatePost(projectId);
  const [pending, setPending] = useState<PendingPost[]>([]);

  const run = useCallback(
    (item: PendingPost) => {
      setPending((cur) => cur.map((x) => (x.key === item.key ? { ...x, status: 'sending' } : x)));
      createPost
        .mutateAsync(item.body)
        .then(() => setPending((cur) => cur.filter((x) => x.key !== item.key)))
        .catch(() => setPending((cur) => cur.map((x) => (x.key === item.key ? { ...x, status: 'failed' } : x))));
    },
    [createPost],
  );

  const send = useCallback(
    (body: CreatePostBodyDto) => {
      const item: PendingPost = { key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, body, status: 'sending' };
      setPending((cur) => [...cur, item]);
      run(item);
    },
    [run],
  );

  const retry = useCallback((item: PendingPost) => run(item), [run]);
  const discard = useCallback((item: PendingPost) => setPending((cur) => cur.filter((x) => x.key !== item.key)), []);

  return { pending, send, retry, discard };
}
