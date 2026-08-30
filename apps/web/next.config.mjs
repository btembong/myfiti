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
    // Alias 'react' (exact) to the CJS file directly, bypassing the package's
    // "react-server" exports condition which Next.js server webpack activates
    // (resolving 'react' → react.react-server.js, an RSC-only build with no hooks).
    webpackConfig.resolve.alias = {
      ...webpackConfig.resolve.alias,
      'react$': path.join(NEXT_COMPILED, 'react/cjs/react.production.js'),
      'react/jsx-runtime': path.join(NEXT_COMPILED, 'react/jsx-runtime.js'),
      'react/jsx-dev-runtime': path.join(NEXT_COMPILED, 'react/jsx-dev-runtime.js'),
    }

    // Append useEffectEvent + Activity to react.production.js at build time.
    // The IIFE reads module.exports *after* React finishes setting it up,
    // so the polyfill lands on the object that require('react') actually returns.
    webpackConfig.module.rules.push({
      test: /react\.production\.js$/,
      include: /compiled[\\/]react[\\/]cjs/,
      enforce: 'post',
      use: [
        { loader: path.resolve(__dirname, './scripts/react-compat-loader.js') },
      ],
    })

    return webpackConfig
  },
}

export default config
