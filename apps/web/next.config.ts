import path from 'node:path';
import type { NextConfig } from 'next';

// Where the Express API lives. The browser only ever talks to THIS site: `/api/*` is proxied to the
// API, so the httpOnly refresh cookie is same-origin (no CORS, no third-party cookie problems).
const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:4000';
const dev = process.env.NODE_ENV !== 'production';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: dev ? 'SAMEORIGIN' : 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  {
    key: 'Content-Security-Policy',
    value: `frame-ancestors ${dev ? "'self'" : "'none'"}; base-uri 'self'; object-src 'none'; form-action 'self'`,
  },
];

const nextConfig: NextConfig = {
  // The contracts package ships TypeScript source (no build step).
  transpilePackages: ['@vastu/contracts'],
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` }];
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Android App Links verification file (apps/web/public/.well-known/assetlinks.json, see
      // docs/mobile/07-app-links.md). Must be application/json, served directly (no redirect).
      {
        source: '/.well-known/assetlinks.json',
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
    ];
  },
  images: { remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }] },
  turbopack: { root: path.resolve(import.meta.dirname, '../..') },
  // The shared contracts are written for Node's ESM rules (`import './http.js'` means http.ts).
  // Turbopack cannot map that yet, so this app builds with webpack (`next dev/build --webpack`).
  webpack(config) {
    config.resolve.extensionAlias = { '.js': ['.ts', '.tsx', '.js'], '.mjs': ['.mts', '.mjs'] };
    return config;
  },
};

export default nextConfig;
