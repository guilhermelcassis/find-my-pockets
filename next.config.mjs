/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure React strict mode
  reactStrictMode: true,
  
  // Configure experimental features
  experimental: {
    // For better HMR and module resolution
    esmExternals: 'loose',
    
    // For framer-motion compatibility
    optimizePackageImports: [
      'framer-motion',
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-label',
      '@radix-ui/react-slot',
      '@radix-ui/react-toast'
    ]
  },
  
  // Handle transpilation of node modules
  transpilePackages: [
    'framer-motion',
    'lucide-react',
    '@emotion/react',
    '@emotion/styled'
  ],
  
  // Webpack configuration
  webpack: (config, { isServer }) => {
    // Fix for HMR issues with framer-motion
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'framer-motion': require.resolve('framer-motion'),
      };
    }
    return config;
  }
};

export default nextConfig; 