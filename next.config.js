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
  // Prevent duplicate script loading and optimize script loading
  experimental: {
    optimizePackageImports: ['react-dom', 'react']
  },
  // Help prevent page reloads during development
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
    }
    return config
  },
};

module.exports = nextConfig; 