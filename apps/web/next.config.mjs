import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

// Next.js bundles its own React 19.2-canary (which has Activity + useEffectEvent).
// We point ALL react imports at that single copy so there's only one React instance.
// jsx-runtime and jsx-dev-runtime must also be aliased, otherwise they resolve to
// workspace react@19.1.0 and create a second React instance that breaks hooks.
const NEXT_COMPILED = path.resolve(__dirname, '../../node_modules/next/dist/compiled')

const config = {
  transpilePackages: [
    '@mantine/core',
    '@mantine/hooks',
    '@mantine/form',
    '@mantine/dates',
    '@mantine/notifications',
    '@mantine/modals',
    '@mantine/charts',
    '@mantine/spotlight',
    'mantine-datatable',
  ],
  images: {
    remotePatterns: [
      { hostname: 'media.gymflow.app' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_URL}/api/:path*`,
      },
    ]
  },
  webpack(webpackConfig) {
    // Alias react directly to the CJS file, NOT to the package directory.
    // The package directory has a "react-server" exports condition that Next.js's
    // server webpack activates, resolving 'react' -> react.react-server.js (RSC-only,
    // no useEffectEvent). Pointing to the CJS file bypasses exports conditions entirely
    // and ensures client React (with our polyfills) is used for all app code.
    webpackConfig.resolve.alias = {
      ...webpackConfig.resolve.alias,
      'react$': path.join(NEXT_COMPILED, 'react/cjs/react.production.js'),
      'react/jsx-runtime': path.join(NEXT_COMPILED, 'react/jsx-runtime.js'),
      'react/jsx-dev-runtime': path.join(NEXT_COMPILED, 'react/jsx-dev-runtime.js'),
    }
    return webpackConfig
  },
}

export default config
