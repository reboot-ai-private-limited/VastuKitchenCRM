'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { ProposalTheme } from '@vastu/contracts';

/** A4 at 96 dpi. Every block is laid out for this size; phones scale it down. */
export const SHEET_W = 794;
export const SHEET_H = 1123;

export function themeVars(t: ProposalTheme): CSSProperties {
  return {
    '--t-primary': t.primary,
    '--t-ink': t.ink,
    '--t-paper': t.paper,
    '--t-tint': t.tint,
    '--t-accent': t.accent,
  } as CSSProperties;
}

/**
 * One A4 page. On screen it is scaled to the width available (so a phone sees the whole sheet);
 * in print it is exactly A4 with a page break after it.
 */
export function Sheet({ theme, children }: { theme: ProposalTheme; children: ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / SHEET_W));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={wrap}
      className="proposal-sheet-wrap mx-auto w-full overflow-hidden print:!h-auto print:overflow-visible"
      style={{ maxWidth: SHEET_W, height: SHEET_H * scale }}
    >
      <div
        className="proposal-sheet relative overflow-hidden shadow-card print:shadow-none"
        style={{
          ...themeVars(theme),
          width: SHEET_W,
          height: SHEET_H,
          background: 'var(--t-paper)',
          color: 'var(--t-ink)',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  );
}
