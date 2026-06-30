import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Whalabi — El chat privado de tu organización',
  description:
    'PWA de mensajería organizacional privada sobre Matrix/Synapse, sin número telefónico.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Whalabi',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/icons/icon.svg',
    apple: '/icons/icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
