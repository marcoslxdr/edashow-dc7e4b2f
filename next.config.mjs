/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_ENABLE_POST_GENERATION: process.env.ENABLE_POST_GENERATION ?? 'false',
  },

  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    // Fix for webpack module errors
    optimizePackageImports: ['@supabase/supabase-js', '@supabase/ssr'],
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  // Fix for webpack caching issues
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ['**/node_modules', '**/.git', '**/.next'],
      }
    }
    return config
  },

  // Turbopack config (Next.js 16+ uses Turbopack by default)
  turbopack: {},
}

export default nextConfig