import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Newsreader, Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-thought',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Stranger Sky',
  description: 'A quiet night sky of strangers. Drift, find a thought that fits, say hello.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/web-app-manifest-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/web-app-manifest-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  robots: { index: true, follow: true },
};
export const viewport: Viewport = { themeColor: '#070b1a', width: 'device-width', initialScale: 1, viewportFit: 'cover', maximumScale: 1, interactiveWidget: 'resizes-content' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await headers(); // opts every page into per-request rendering so the CSP nonce can be applied
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable}`} suppressHydrationWarning>
      <body className={`${inter.variable} ${newsreader.variable}`} suppressHydrationWarning>
        <div className="sky-bg" aria-hidden />
        {children}
      </body>
    </html>
  );
}
