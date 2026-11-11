'use client';

import { useEffect } from 'react';
import { api } from '@/lib/api/client';

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
    api(`/public/proposals/${token}/seen`, { method: 'POST', anonymous: true }).catch(
      () => undefined,
    );
  }, [token]);
  return null;
}
