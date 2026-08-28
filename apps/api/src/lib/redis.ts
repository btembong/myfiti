import { Redis } from '@upstash/redis'

const hasRedisConfig = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)

// When Redis env vars are set, use real client. Otherwise use noop for local dev.
const noopRedis = {
  get: async () => null,
  set: async () => 'OK',
  del: async () => 0,
} as unknown as Redis

export const redis = hasRedisConfig ? Redis.fromEnv() : noopRedis

// ─── Subscription status cache ───────────────────────────────────────────────
// Key: `sub:status:{tenant_id}:{member_id}`  Value: SubscriptionStatus
// TTL: 5 minutes — the cron job updates this on every state transition

export const SUBSCRIPTION_CACHE_TTL = 60 * 5  // 5 minutes

export async function getCachedSubscriptionStatus(
  tenantId: string,
  memberId: string
): Promise<string | null> {
  return redis.get(`sub:status:${tenantId}:${memberId}`)
}

export async function setCachedSubscriptionStatus(
  tenantId: string,
  memberId: string,
  status: string
): Promise<void> {
  await redis.set(
    `sub:status:${tenantId}:${memberId}`,
    status,
    { ex: SUBSCRIPTION_CACHE_TTL }
  )
}

export async function invalidateSubscriptionCache(
  tenantId: string,
  memberId: string
): Promise<void> {
  await redis.del(`sub:status:${tenantId}:${memberId}`)
}
