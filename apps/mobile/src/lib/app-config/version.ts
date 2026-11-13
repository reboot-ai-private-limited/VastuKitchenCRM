/** Dotted app versions ("1.4.2"); a "-beta" style suffix is ignored. Mirrors the API's rules. */
function parse(text: string): [number, number, number] | null {
  const m = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+][0-9A-Za-z.-]+)?$/.exec(text.trim());
  return m ? [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)] : null;
}

/** True only when both versions are readable and `a` is older than `b`. Unreadable means "not older". */
export function isOlder(a: string, b: string): boolean {
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return false;
  for (let i = 0; i < 3; i++) {
    if (pa[i]! !== pb[i]!) return pa[i]! < pb[i]!;
  }
  return false;
}
