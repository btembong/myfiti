import { Queue } from 'bullmq'

// ─── Connection config ────────────────────────────────────────────────────────
// Prefer explicit BULLMQ_REDIS_HOST, fall back to parsing REDIS_URL

export function buildConnection() {
  const host = process.env.BULLMQ_REDIS_HOST
  const redisUrl = process.env.REDIS_URL

  const isUpstash = (h: string) => h.includes('upstash')

  if (host) {
    return {
      host,
      port: Number(process.env.BULLMQ_REDIS_PORT ?? 6379),
      password: process.env.BULLMQ_REDIS_PASSWORD,
      ...(isUpstash(host) ? { tls: {} } : {}),
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 20_000,
      lazyConnect: true,
    }
  }

  if (redisUrl) {
    try {
      const url = new URL(redisUrl)
      const h = url.hostname
      return {
        host: h,
        port: Number(url.port || 6379),
        password: url.password || undefined,
        ...(url.protocol === 'rediss:' || isUpstash(h) ? { tls: {} } : {}),
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        connectTimeout: 20_000,
        lazyConnect: true,
      }
    } catch {
      console.error('[jobs] Invalid REDIS_URL:', redisUrl)
    }
  }

  return undefined
}

const connection = buildConnection()

if (connection) {
  console.log(`[jobs] Redis connection: ${connection.host}:${connection.port} (TLS: ${'tls' in connection})`)
} else {
  console.log('[jobs] Redis not configured — queues and workers disabled')
}

// ─── Noop queue for local dev without Redis ──────────────────────────────────
const noopQueue = { add: async () => ({}) } as unknown as Queue

// ─── Queues ──────────────────────────────────────────────────────────────────

function makeQueue(name: string) {
  if (!connection) return noopQueue
  const q = new Queue(name, { connection })
  // Suppress unhandled connection-error noise — ioredis retries automatically
  q.on('error', (err: Error) => {
    if ((err as NodeJS.ErrnoException).code === 'ETIMEDOUT' || err.message.includes('connect')) {
      console.warn(`[jobs] ${name} queue: Redis reconnecting (${err.message})`)
    } else {
      console.error(`[jobs] ${name} queue error:`, err.message)
    }
  })
  return q
}

export const notificationQueue = makeQueue('notifications')
export const subscriptionQueue = makeQueue('subscriptions')
export const paymentQueue      = makeQueue('payments')

// ─── Workers ─────────────────────────────────────────────────────────────────

if (connection) {
  import('./workers/subscription.worker.js')
  import('./workers/payment.worker.js')
}
