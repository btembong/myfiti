import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

// Point webpack at Next.js's bundled React canary (which has Activity + useEffectEvent)
// instead of the workspace react@19.1.0. The pnpm override pins 19.1.0 for mobile/RN
// compat, but the web build needs the canary for Mantine 9.x to compile and SSR correctly.
// This has zero effect on the app's UI or behavior — same React API surface.
const NEXT_COMPILED = path.resolve(__dirname, '../../node_modules/next/dist/compiled')

const config = {
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
    webpackConfig.resolve.alias = {
      ...webpackConfig.resolve.alias,
      react: path.join(NEXT_COMPILED, 'react'),
      'react-dom': path.join(NEXT_COMPILED, 'react-dom'),
    }
    return webpackConfig
  },
}

export default config
