import type { MetadataRoute } from 'next';

const brandPath = '/MIZANIA_BRAND_PACKAGE';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mizania Business Suite',
    short_name: 'Mizania',
    description: 'Rekodi, fuatilia na simamia shughuli za biashara katika sehemu moja.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f3efe6',
    theme_color: '#f3efe6',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: `${brandPath}/logos/png/mizania-app-icon-192x192.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${brandPath}/pwa/mizania-maskable-192x192.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: `${brandPath}/pwa/mizania-maskable-512x512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Dashboard',
        short_name: 'Dashboard',
        url: '/dashboard',
        icons: [{ src: `${brandPath}/logos/png/mizania-app-icon-192x192.png`, sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Purchases',
        short_name: 'Purchases',
        url: '/dashboard/purchases',
        icons: [{ src: `${brandPath}/logos/png/mizania-app-icon-192x192.png`, sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
