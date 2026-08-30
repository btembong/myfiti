import type { Request, Response, NextFunction } from 'express'
import { db, globalSchema, eq } from '../db/client.js'
import { redis } from '../lib/redis.js'
import type { Tenant } from '../db/schema/global.js'

declare global {
  namespace Express {
    interface Request {
      tenant: Tenant
    }
  }
}

const TENANT_CACHE_TTL = 60 * 10  // 10 minutes

export async function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip global routes that don't need tenant context
  if (
    req.path.startsWith('/auth/') ||
    req.path.startsWith('/onboarding/') ||
    req.path.startsWith('/webhooks/') ||
    req.path.startsWith('/superadmin/') ||
    req.path.startsWith('/public/')
  ) return next()

  // Resolve tenant from X-Tenant-ID header (set by API gateway from subdomain)
  const tenantId = req.headers['x-tenant-id'] as string | undefined
  const tenantSlug = (req.headers['x-tenant-slug'] as string | undefined) ?? (req.query.slug as string | undefined)

  if (!tenantId && !tenantSlug) {
    return res.status(400).json({ error: 'missing_tenant', message: 'Tenant could not be resolved.' })
  }

  const cacheKey = `tenant:${tenantId ?? tenantSlug}`

  // Try cache first — bail out after 300 ms so Redis latency never blocks requests
  try {
    const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 300))
    const cached = await Promise.race([redis.get<Tenant>(cacheKey), timeout])
    if (cached) {
      req.tenant = cached
      return next()
    }
  } catch {
    // Redis unavailable — fall through to DB
  }

  // Fetch from DB
  let tenant: Tenant | undefined
  try {
    ;[tenant] = await db
      .select()
      .from(globalSchema.tenants)
      .where(
        tenantId
          ? eq(globalSchema.tenants.id, tenantId)
          : eq(globalSchema.tenants.slug, tenantSlug!)
      )
      .limit(1)
  } catch (err) {
    console.error('[tenant] DB unreachable:', (err as Error).message)
    return res.status(503).json({ error: 'db_unavailable', message: 'Service temporarily unavailable.' })
  }

  if (!tenant) {
    return res.status(404).json({ error: 'tenant_not_found', message: 'Gym not found.' })
  }

  // Block suspended or cancelled tenants
  if (tenant.status === 'suspended' || tenant.status === 'cancelled') {
    return res.status(403).json({ error: 'tenant_suspended', message: 'This gym account is suspended.' })
  }

  // Block trialing tenants whose trial has expired (except billing routes)
  if (
    tenant.status === 'trialing' &&
    tenant.trial_ends_at &&
    new Date(tenant.trial_ends_at) < new Date() &&
    !req.path.startsWith('/billing')
  ) {
    return res.status(402).json({
      error: 'trial_expired',
      message: 'Your trial has ended. Upgrade to continue.',
      upgrade_url: `https://myfiti.app/billing/${tenant.slug}`,
    })
  }

  // Cache result — fire-and-forget, never block the response
  redis.set(cacheKey, tenant, { ex: TENANT_CACHE_TTL }).catch(() => {})
  req.tenant = tenant
  next()
}
