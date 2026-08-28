import { Ratelimit } from '@upstash/ratelimit'
import type { Request, Response, NextFunction } from 'express'
import { redis } from '../lib/redis.js'

const hasRedisConfig = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)

// Strict limiter for auth endpoints: 10 requests per 60 seconds per IP
const authLimiter = hasRedisConfig
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '60 s'), prefix: 'rl:auth' })
  : null

// General API limiter: 100 requests per 60 seconds per IP
const apiLimiter = hasRedisConfig
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, '60 s'), prefix: 'rl:api' })
  : null

function getIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? 'unknown'
}

export function rateLimitAuth(req: Request, res: Response, next: NextFunction) {
  if (!authLimiter) return next()

  const ip = getIp(req)
  authLimiter.limit(ip).then(({ success, remaining, reset }) => {
    res.setHeader('X-RateLimit-Remaining', remaining)
    res.setHeader('X-RateLimit-Reset', reset)
    if (!success) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' })
    }
    next()
  }).catch(() => next()) // Fail open if Redis is down
}

export function rateLimitApi(req: Request, res: Response, next: NextFunction) {
  if (!apiLimiter) return next()

  const ip = getIp(req)
  apiLimiter.limit(ip).then(({ success, remaining, reset }) => {
    res.setHeader('X-RateLimit-Remaining', remaining)
    res.setHeader('X-RateLimit-Reset', reset)
    if (!success) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' })
    }
    next()
  }).catch(() => next())
}
