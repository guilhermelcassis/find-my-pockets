/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  // Add optimization for third-party scripts
  compiler: {
    // Enables the styled-components SWC transform if you're using styled components
    styledComponents: true
  },
  // Configure features with valid experimental options only
  experimental: {
    // Valid packages to optimize
    optimizePackageImports: ['react-dom', 'react'],
    // Optimize CSS - valid experimental option
    optimizeCss: true
  },
  // Help prevent page reloads during development
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
    };
    return config;
  },
  // Add specific settings for Vercel deployments
  images: {
    domains: ['maps.googleapis.com', 'maps.gstatic.com']
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=600, must-revalidate'
          }
        ]
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate'
          }
        ]
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      }
    ]
  },
  // Add specific env config for Vercel environment
  env: {
    VERCEL_ENV: process.env.VERCEL_ENV || 'development'
  },
  // Optimize static rendering and reduce client-side JavaScript
  reactStrictMode: false,
  poweredByHeader: false
};

module.exports = nextConfig; 