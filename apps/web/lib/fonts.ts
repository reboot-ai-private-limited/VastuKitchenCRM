import { Playfair_Display } from 'next/font/google';

/** Proposal headings and totals only (docs/05-design/design-system.md §2). */
export const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' });
