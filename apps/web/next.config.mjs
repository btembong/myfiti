/** @type {import('next').NextConfig} */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

const config = {
  images: {
    remotePatterns: [
      { hostname: 'media.gymflow.app' },   // Cloudflare R2 public URL
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
}

export default config
