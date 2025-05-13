/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Support both Pages Router and App Router
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  // Configure server components
  serverExternalPackages: [],
  // Configure image domains
  images: {
    domains: ['localhost'],
  },
  // Disable webpack 5 persistent caching in development
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig 