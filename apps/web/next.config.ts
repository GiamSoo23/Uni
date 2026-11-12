import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // @uni/core ships as uncompiled TypeScript inside the monorepo.
  transpilePackages: ['@uni/core'],
}

export default nextConfig
