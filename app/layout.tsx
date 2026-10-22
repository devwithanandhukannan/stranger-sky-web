import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Newsreader } from 'next/font/google';
import './globals.css';

const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-thought',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Lumen',
  description: 'A quiet night sky of strangers. Drift, find a thought that fits, say hello.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg' },
  robots: { index: true, follow: true },
};
export const viewport: Viewport = { themeColor: '#070b1a', width: 'device-width', initialScale: 1, viewportFit: 'cover', maximumScale: 1, interactiveWidget: 'resizes-content' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await headers(); // opts every page into per-request rendering so the CSP nonce can be applied
  return (
    <html lang="en" className={newsreader.variable}>
      <body className={newsreader.variable}>
        <div className="sky-bg" aria-hidden />
        {children}
      </body>
    </html>
  );
}
