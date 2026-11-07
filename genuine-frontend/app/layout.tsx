import type { Metadata } from 'next';
import './globals.css';
import { AppToaster } from '@/components/ui/AppToaster';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { PWAExperience } from '@/components/pwa/PWAExperience';
import { PwaThemeColor } from '@/components/pwa/PwaThemeColor';

export const metadata: Metadata = {
  title: 'Mizania Business Suite',
  applicationName: 'Mizania Business Suite',
  description: 'Rekodi, fuatilia na simamia shughuli za biashara katika sehemu moja.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Mizania',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      {
        url: '/MIZANIA_BRAND_PACKAGE/logos/png/mizania-app-icon-16x16.png',
        sizes: '16x16',
        type: 'image/png',
      },
      {
        url: '/MIZANIA_BRAND_PACKAGE/logos/png/mizania-app-icon-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
    ],
    apple: [
      {
        url: '/MIZANIA_BRAND_PACKAGE/pwa/apple-touch-icon-180x180.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="referrer" content="no-referrer" />
        <meta name="theme-color" content="#f0f2ee" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Mizania" />
      </head>
      <body><ThemeProvider>{children}<PwaThemeColor /><PWAExperience /><AppToaster /></ThemeProvider></body>
    </html>
  );
}
