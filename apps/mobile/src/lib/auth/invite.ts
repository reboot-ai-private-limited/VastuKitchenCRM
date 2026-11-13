/** Accepts a raw token or a pasted invite link; returns the token or null. */
export function parseInviteToken(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  const m = /\/invite\/([^/?#\s]+)/.exec(v) ?? /[?&]token=([^&#\s]+)/.exec(v);
  const raw = m ? m[1]! : /^[\w.~-]{16,}$/.test(v) ? v : null;
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
