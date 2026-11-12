/** Dotted app versions ("1.4.2"). A "-beta.1" or "+build" suffix is ignored; missing parts are 0. */
export type ParsedVersion = [number, number, number];

export function parseVersion(text: string): ParsedVersion | null {
  const m = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+][0-9A-Za-z.-]+)?$/.exec(text.trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)];
}

/** Negative when a is older than b, 0 when equal, positive when newer. NaN when either is unparseable. */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return Number.NaN;
  for (let i = 0; i < 3; i++) {
    const d = pa[i]! - pb[i]!;
    if (d !== 0) return d;
  }
  return 0;
}
