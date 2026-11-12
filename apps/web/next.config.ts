import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // @uni/core se publica como TypeScript sin compilar dentro del monorepo.
  transpilePackages: ['@uni/core'],
}

export default nextConfig
