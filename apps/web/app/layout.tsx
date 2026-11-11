import type { Metadata, Viewport } from 'next';
import { Jost } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const jost = Jost({ subsets: ['latin'], variable: '--font-jost', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Vaastu Kitchen', template: '%s · Vaastu Kitchen' },
  description: 'Vaastu Kitchen CRM',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#0e8f78', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jost.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
