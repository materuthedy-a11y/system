/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  swcMinify: true,
  compress: true,
  output: 'standalone',
  
  images: {
    unoptimized: false,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },

  headers: async () => {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-store, max-age=0, must-revalidate',
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },

  env: {
    NEXT_PUBLIC_API_URL: (() => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ||
        (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3002/api/v1');
      if (process.env.NODE_ENV === 'production') {
        let parsed;
        try {
          parsed = new URL(apiUrl);
        } catch {
          throw new Error('Set NEXT_PUBLIC_API_URL to the deployed HTTPS backend URL ending in /api/v1.');
        }
        if (parsed.protocol !== 'https:' || parsed.pathname.replace(/\/$/, '') !== '/api/v1' || /localhost|127\.0\.0\.1|your[-_. ]?(domain|url)|example\.com|placeholder/i.test(apiUrl)) {
          throw new Error('NEXT_PUBLIC_API_URL must be a real HTTPS production API URL ending in /api/v1, not localhost or a placeholder.');
        }
      }
      return apiUrl;
    })(),
  },

  experimental: {
    serverComponentsExternalPackages: ['pdfkit'],
  },
};

module.exports = nextConfig;
