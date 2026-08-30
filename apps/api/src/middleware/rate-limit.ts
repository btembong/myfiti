import { Ratelimit } from '@upstash/ratelimit'
import type { Request, Response, NextFunction } from 'express'
import { redis } from '../lib/redis.js'

const hasRedisConfig = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)

// Auth: 10 req / 60 s per IP
const authLimiter = hasRedisConfig
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '60 s'), prefix: 'rl:auth' })
  : null

// General API: 100 req / 60 s per IP
const apiLimiter = hasRedisConfig
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, '60 s'), prefix: 'rl:api' })
  : null

// Wallet mutations (topup, cashout, transfer, pay): 5 per 60 s per authenticated user
// Keyed on member ID — not IP — so shared IPs (e.g. gym WiFi) don't interfere.
const walletMutationLimiter = hasRedisConfig
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '60 s'), prefix: 'rl:wallet' })
  : null

// Wallet / phone lookup: 3 per 60 s per user — prevents phone-number enumeration
const walletLookupLimiter = hasRedisConfig
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, '60 s'), prefix: 'rl:wallet:lookup' })
  : null

function getIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? 'unknown'
}

function getMemberId(req: Request): string {
  // req.auth is populated by the JWT middleware before these limiters run
  const auth = (req as Request & { auth?: { sub?: string } }).auth
  return auth?.sub ?? getIp(req) // fall back to IP if auth not yet resolved
}

export function rateLimitAuth(req: Request, res: Response, next: NextFunction) {
  if (!authLimiter) return next()
  const ip = getIp(req)
  authLimiter.limit(ip).then(({ success, remaining, reset }) => {
    res.setHeader('X-RateLimit-Remaining', remaining)
    res.setHeader('X-RateLimit-Reset', reset)
    if (!success) return res.status(429).json({ error: 'Too many requests. Please try again later.' })
    next()
  }).catch(() => next())
}

export function rateLimitApi(req: Request, res: Response, next: NextFunction) {
  if (!apiLimiter) return next()
  const ip = getIp(req)
  apiLimiter.limit(ip).then(({ success, remaining, reset }) => {
    res.setHeader('X-RateLimit-Remaining', remaining)
    res.setHeader('X-RateLimit-Reset', reset)
    if (!success) return res.status(429).json({ error: 'Too many requests. Please try again later.' })
    next()
  }).catch(() => next())
}

/**
 * Strict per-user limiter for wallet mutation endpoints.
 * 5 mutations per minute per authenticated member.
 * Apply to: POST /topup, /cashout, /transfer, /pay-subscription, /pay-plan
 */
export function rateLimitWallet(req: Request, res: Response, next: NextFunction) {
  if (!walletMutationLimiter) return next()
  const key = getMemberId(req)
  walletMutationLimiter.limit(key).then(({ success, remaining, reset }) => {
    res.setHeader('X-RateLimit-Remaining', remaining)
    res.setHeader('X-RateLimit-Reset', reset)
    if (!success) {
      return res.status(429).json({
        error: 'rate_limited',
        message: 'Too many wallet requests. Please wait a moment and try again.',
      })
    }
    next()
  }).catch(() => next()) // Fail open — never block on Redis failure
}

/**
 * Strict per-user limiter for phone/wallet lookup endpoints.
 * 3 lookups per minute per user — prevents member enumeration via phone number.
 */
export function rateLimitWalletLookup(req: Request, res: Response, next: NextFunction) {
  if (!walletLookupLimiter) return next()
  const key = getMemberId(req)
  walletLookupLimiter.limit(key).then(({ success, remaining, reset }) => {
    res.setHeader('X-RateLimit-Remaining', remaining)
    res.setHeader('X-RateLimit-Reset', reset)
    if (!success) {
      return res.status(429).json({
        error: 'rate_limited',
        message: 'Too many lookup requests. Please wait a moment.',
      })
    }
    next()
  }).catch(() => next())
}
