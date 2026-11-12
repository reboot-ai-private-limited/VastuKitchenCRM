'use client';

import { useEffect } from 'react';
import { ApiError, api } from '@/lib/api/client';
import { SESSION_HINT_COOKIE } from '@/lib/api/session';

/**
 * Tells the API a person (not a chat app's link preview) opened the page. Crawlers never run this:
 * that is the whole point of sending "seen" from the browser instead of counting the GET.
 */
export function SeenPing({ token }: { token: string }) {
  useEffect(() => {
    // Once per tab per proposal, so a refresh doesn't pad the view count.
    const key = `seen:${token}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      /* storage blocked: still send, the API only counts the first view specially */
    }
    // Signed-in staff must not count as the customer, so a session (if any) is sent along and the
    // API decides. A dead session falls back to an anonymous ping.
    const path = `/public/proposals/${token}/seen`;
    const signedIn = document.cookie.includes(`${SESSION_HINT_COOKIE}=`);
    api(path, { method: 'POST', anonymous: !signedIn })
      .catch((e) =>
        e instanceof ApiError && e.status === 401
          ? api(path, { method: 'POST', anonymous: true })
          : undefined,
      )
      .catch(() => undefined);
  }, [token]);
  return null;
}
