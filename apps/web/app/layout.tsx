import type { Metadata, Viewport } from 'next';
import { Roboto } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-roboto',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Vaastu Kitchen', template: '%s · Vaastu Kitchen' },
  description: 'Vaastu Kitchen CRM',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#0e8f78', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={roboto.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
