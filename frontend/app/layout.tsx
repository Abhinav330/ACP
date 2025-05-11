import './globals.css';
import type { Metadata } from 'next';
import { Viewport } from 'next';
import { Providers } from './providers';
import LayoutWrapper from './components/LayoutWrapper';
import ClientLayout from './components/ClientLayout';

export const viewport: Viewport = {
  themeColor: '#000000',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Algo Crafters',
  description: 'A platform for competitive programming and algorithm practice',
  keywords: ['competitive programming', 'algorithms', 'coding', 'practice', 'problems'],
  authors: [{ name: 'Algo Crafters Team' }],
  creator: 'Algo Crafters',
  publisher: 'Algo Crafters',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <ClientLayout>
            <LayoutWrapper>{children}</LayoutWrapper>
          </ClientLayout>
        </Providers>
      </body>
    </html>
  );
} 