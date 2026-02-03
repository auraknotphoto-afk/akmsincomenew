import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import BottomNav from './components/BottomNav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aura Knot Photography - Income Tracker',
  description: 'Professional income tracking and job management system for photographers',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Aura Knot',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0f172a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          <main className="pb-20 md:pb-0">
            {children}
          </main>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
