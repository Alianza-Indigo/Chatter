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
  // Estándar moderno (Chrome/Android); complementa al meta de Apple y silencia
  // el aviso de deprecación en consola.
  other: {
    'mobile-web-app-capable': 'yes',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
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
