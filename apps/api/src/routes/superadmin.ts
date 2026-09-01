import { Router, type Request, type Response, type NextFunction } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { v4 as uuid } from 'uuid'
import { db, globalSchema, eq, globalQuery, tenantQuery } from '../db/client.js'
import { rateLimitAuth } from '../middleware/rate-limit.js'
import { buildInvoicePDF, type InvoiceData } from '../lib/pdf.js'
import { sendInvoiceNotificationEmail, sendPlanChangeEmail, sendSuperadminMessageEmail, sendSupportReplyEmail, sendAnnouncementEmail } from '../lib/email.js'
import { redis } from '../lib/redis.js'
import { generateMonthlyInvoices } from '../jobs/billing-cron.js'
import { runWalletReconcile } from '../jobs/wallet-reconcile-cron.js'

// ─── Account number bootstrap (idempotent) ───────────────────────────────────
// Adds account_number column and backfills existing tenants with GYM-XXXXXX IDs

async function ensureAccountNumbers() {
  try {
    // Add column if missing
    await globalQuery(`
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS account_number TEXT UNIQUE
    `)
    // Create sequence if missing (safe to re-run)
    await globalQuery(`
      CREATE SEQUENCE IF NOT EXISTS tenant_account_seq START 1
    `)
    // Backfill any tenants that don't have an account number yet
    await globalQuery(`
      UPDATE tenants
      SET account_number = 'GYM-' || LPAD(nextval('tenant_account_seq')::TEXT, 6, '0')
      WHERE account_number IS NULL
    `)
  } catch (err) {
    console.error('[bootstrap] Failed to ensure account numbers:', err)
  }
}

ensureAccountNumbers()

// ─── Support tables bootstrap (idempotent) ───────────────────────────────────

async function ensureSupportTables() {
  try {
    await globalQuery(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id TEXT PRIMARY KEY,
        tenant_id TEXT REFERENCES tenants(id) ON DELETE SET NULL,
        subject TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        priority TEXT NOT NULL DEFAULT 'medium',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await globalQuery(`
      CREATE TABLE IF NOT EXISTS support_messages (
        id TEXT PRIMARY KEY,
        ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
        from_role TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
  } catch (err) {
    console.error('[support] Failed to create support tables:', err)
  }
}

ensureSupportTables()

// ─── Platform tables bootstrap (idempotent) ───────────────────────────────────

async function ensurePlatformTables() {
  try {
    // Platform key-value settings store
    await globalQuery(`
      CREATE TABLE IF NOT EXISTS platform_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    // Seed default settings (safe to re-run — ON CONFLICT DO NOTHING)
    await globalQuery(`
      INSERT INTO platform_settings (key, value) VALUES
        ('maintenance_mode',   'false'),
        ('new_registrations',  'true'),
        ('trial_enabled',      'true'),
        ('trial_days',         '14'),
        ('platform_timezone',  'Africa/Douala'),
        ('default_currency',   'XAF'),
        ('email_from',         'platform@myfiti.app'),
        ('email_name',         'myfiti Platform')
      ON CONFLICT (key) DO NOTHING
    `)

    // Feature flags
    await globalQuery(`
      CREATE TABLE IF NOT EXISTS feature_flags (
        key TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        description TEXT,
        group_name TEXT,
        risk TEXT DEFAULT 'low',
        global_enabled BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await globalQuery(`
      CREATE TABLE IF NOT EXISTS feature_flag_overrides (
        flag_key TEXT NOT NULL REFERENCES feature_flags(key) ON DELETE CASCADE,
        tenant_id TEXT NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        PRIMARY KEY (flag_key, tenant_id)
      )
    `)

    // Seed default flags
    await globalQuery(`
      INSERT INTO feature_flags (key, label, description, group_name, risk, global_enabled) VALUES
        ('qr_checkin_v2',      'QR Check-in v2',          'New QR scan engine with improved Android compatibility.',        'Check-in',   'low',    true),
        ('messaging_v2',       'In-app messaging v2',      'Updated message thread UI with read receipts and reactions.',     'Messaging',  'low',    false),
        ('ai_suggestions',     'AI member suggestions',    'AI-generated retention alerts for at-risk members.',             'AI',         'medium', false),
        ('bulk_sms',           'Bulk SMS campaigns',       'Send SMS blasts to all members or segments.',                    'Messaging',  'medium', false),
        ('multi_location',     'Multi-location support',   'Allow a single gym account to manage multiple branches.',        'Growth+',    'medium', false),
        ('stripe_direct',      'Stripe direct payouts',    'Enable direct payout to gym bank accounts via Stripe.',          'Payments',   'high',   false),
        ('maintenance_banner', 'Maintenance banner',       'Show a platform-wide maintenance notice to all gym admins.',     'Platform',   'low',    false),
        ('new_onboarding',     'New onboarding flow',      'Redesigned 5-step gym onboarding wizard for new signups.',       'Onboarding', 'low',    true),
        ('offline_mode',       'Offline kiosk mode',       'Kiosk can handle check-ins offline and sync when reconnected.',  'Kiosk',      'high',   false)
      ON CONFLICT (key) DO NOTHING
    `)

    // Announcements
    await globalQuery(`
      CREATE TABLE IF NOT EXISTS announcements (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        audience TEXT DEFAULT 'all',
        channels TEXT DEFAULT 'email',
        sent_to INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    // User sessions (recorded on login for visibility in superadmin panel)
    await globalQuery(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_name TEXT,
        user_email TEXT,
        role TEXT NOT NULL,
        tenant_id TEXT,
        tenant_name TEXT,
        tenant_slug TEXT,
        ip_address TEXT,
        user_agent TEXT,
        device TEXT,
        browser TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_active_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ,
        terminated BOOLEAN DEFAULT FALSE
      )
    `)
  } catch (err) {
    console.error('[bootstrap] Failed to ensure platform tables:', err)
  }
}

ensurePlatformTables()

export const superadminRouter = Router()

const JWT_EXPIRY = '12h'

function signSuperToken(payload: object): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: JWT_EXPIRY })
}

function requireSuperAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized.' })
  }
  try {
    const token = header.slice(7)
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { role: string; sub: string }
    if (payload.role !== 'superadmin') {
      return res.status(403).json({ error: 'Forbidden.' })
    }
    ;(req as any).superadmin = payload
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' })
  }
}

const planPrices: Record<string, number> = {
  starter: 0,
  growth: 9900,
  growth_plus: 19900,
  enterprise: 49900,
}

superadminRouter.post('/login', rateLimitAuth, async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'email and password required.' })

    const [sa] = await db.select().from(globalSchema.superadmins)
      .where(eq(globalSchema.superadmins.email, email.toLowerCase())).limit(1)
    if (!sa || !sa.is_active) return res.status(401).json({ error: 'Invalid credentials.' })

    const valid = await bcrypt.compare(password, sa.password_hash)
    if (!valid) return res.status(401).json({ error: 'Invalid credentials.' })

    await db.update(globalSchema.superadmins)
      .set({ last_login_at: new Date() })
      .where(eq(globalSchema.superadmins.id, sa.id))

    const token = signSuperToken({ sub: sa.id, email: sa.email, role: 'superadmin', name: sa.name })

    // Record session (best-effort)
    const sessionId = uuid()
    const ua = req.headers['user-agent'] ?? ''
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? ''
    globalQuery(
      `INSERT INTO user_sessions
         (id, user_id, user_name, user_email, role, ip_address, user_agent, device, browser, expires_at)
       SELECT $1,$2,$3,$4,'superadmin',$5,$6,
         CASE WHEN $6 ILIKE '%iphone%' OR $6 ILIKE '%android%' THEN 'Mobile'
              WHEN $6 ILIKE '%windows%' THEN 'Windows'
              WHEN $6 ILIKE '%mac%' THEN 'Mac' ELSE 'Unknown' END,
         CASE WHEN $6 ILIKE '%chrome%' THEN 'Chrome'
              WHEN $6 ILIKE '%firefox%' THEN 'Firefox'
              WHEN $6 ILIKE '%safari%' THEN 'Safari' ELSE 'Unknown' END,
         NOW() + INTERVAL '12 hours'
       WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_sessions')`,
      [sessionId, sa.id, sa.name, sa.email, ip, ua],
    ).catch(() => {})

    res.json({ ok: true, token, name: sa.name })
  } catch (err) {
    console.error('[superadmin/login]', err)
    res.status(500).json({ error: 'Login failed.' })
  }
})

superadminRouter.use(requireSuperAuth)

superadminRouter.get('/overview', async (_req, res) => {
  try {
    const tenants = await db.select().from(globalSchema.tenants)
    const mrr = tenants
      .filter(t => t.status === 'active')
      .reduce((s, t) => s + (planPrices[t.plan] ?? 0), 0)

    res.json({
      totalGyms: tenants.length,
      activeGyms: tenants.filter(t => t.status === 'active').length,
      trialGyms: tenants.filter(t => t.status === 'trialing').length,
      suspendedGyms: tenants.filter(t => t.status === 'suspended').length,
      pastDueGyms: tenants.filter(t => t.status === 'past_due').length,
      cancelledGyms: tenants.filter(t => t.status === 'cancelled').length,
      mrr,
      arr: mrr * 12,
      planDistribution: {
        growth_plus: tenants.filter(t => t.plan === 'growth_plus').length,
        growth: tenants.filter(t => t.plan === 'growth').length,
        starter: tenants.filter(t => t.plan === 'starter').length,
      },
    })
  } catch (err) {
    console.error('[superadmin/overview]', err)
    res.status(500).json({ error: 'Failed to load overview.' })
  }
})

superadminRouter.get('/gyms', async (req, res) => {
  try {
    let tenants = await db.select().from(globalSchema.tenants)
    const { status, plan, search } = req.query

    if (status && typeof status === 'string') {
      tenants = tenants.filter(t => t.status === status)
    }
    if (plan && typeof plan === 'string') {
      tenants = tenants.filter(t => t.plan === plan)
    }
    if (search && typeof search === 'string') {
      const q = search.toLowerCase()
      tenants = tenants.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.owner_email.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q),
      )
    }

    // Enrich with per-tenant member counts and revenue (best-effort, silently skip if schema missing)
    const gyms = await Promise.all(
      tenants.map(async t => {
        try {
          const [memberResult, monthlyRevResult, annualRevResult] = await Promise.all([
            tenantQuery<{ total: string; active: string }>(
              t.slug,
              `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM members`,
            ),
            tenantQuery<{ total: string }>(
              t.slug,
              `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status IN ('paid', 'completed') AND paid_at >= date_trunc('month', NOW())`,
            ),
            tenantQuery<{ total: string }>(
              t.slug,
              `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status IN ('paid', 'completed') AND paid_at >= NOW() - INTERVAL '1 year'`,
            ),
          ])
          const m = memberResult.rows[0]
          const mr = monthlyRevResult.rows[0]
          const ar = annualRevResult.rows[0]

          return {
            ...t,
            totalMembers: parseInt(m?.total ?? '0'),
            activeMembers: parseInt(m?.active ?? '0'),
            monthlyRevenueXAF: parseInt(mr?.total ?? '0'),
            annualRevenueXAF: parseInt(ar?.total ?? '0'),
          }
        } catch {
          return { ...t, totalMembers: 0, activeMembers: 0, monthlyRevenueXAF: 0, annualRevenueXAF: 0 }
        }
      }),
    )

    res.json({ gyms })
  } catch (err) {
    console.error('[superadmin/gyms]', err)
    res.status(500).json({ error: 'Failed to load gyms.' })
  }
})

superadminRouter.get('/gyms/:id', async (req, res) => {
  try {
    const [tenant] = await db.select().from(globalSchema.tenants)
      .where(eq(globalSchema.tenants.id, req.params.id)).limit(1)
    if (!tenant) return res.status(404).json({ error: 'Gym not found.' })

    let stats = { totalMembers: 0, activeMembers: 0, checkinsToday: 0, monthlyRevenueXAF: 0, annualRevenueXAF: 0 }
    try {
      const [memberResult, checkinResult, monthlyRevResult, annualRevResult] = await Promise.all([
        tenantQuery<{ total: string; active: string }>(
          tenant.slug,
          `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM members`,
        ),
        tenantQuery<{ today: string }>(
          tenant.slug,
          `SELECT COUNT(*) as today FROM check_ins WHERE checked_in_at >= CURRENT_DATE`,
        ),
        tenantQuery<{ total: string }>(
          tenant.slug,
          `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status IN ('paid', 'completed') AND paid_at >= date_trunc('month', NOW())`,
        ),
        tenantQuery<{ total: string }>(
          tenant.slug,
          `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status IN ('paid', 'completed') AND paid_at >= NOW() - INTERVAL '1 year'`,
        ),
      ])
      const m = memberResult.rows[0]
      const c = checkinResult.rows[0]
      const mr = monthlyRevResult.rows[0]
      const ar = annualRevResult.rows[0]
      stats = {
        totalMembers: parseInt(m?.total ?? '0'),
        activeMembers: parseInt(m?.active ?? '0'),
        checkinsToday: parseInt(c?.today ?? '0'),
        monthlyRevenueXAF: parseInt(mr?.total ?? '0'),
        annualRevenueXAF: parseInt(ar?.total ?? '0'),
      }
    } catch {
      // Tenant schema may not exist yet
    }

    res.json({ ...tenant, ...stats })
  } catch (err) {
    console.error('[superadmin/gyms/:id]', err)
    res.status(500).json({ error: 'Failed to load gym.' })
  }
})

superadminRouter.patch('/gyms/:id', requireSuperAuth, async (req, res) => {
  try {
    const allowed = ['plan', 'status', 'grace_period_days', 'trial_ends_at']
    const updates: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(req.body)) {
      if (allowed.includes(k)) updates[k] = v
    }
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update.' })

    // Fetch current tenant for context (plan change email, renewal date logic)
    const [existing] = await db.select().from(globalSchema.tenants)
      .where(eq(globalSchema.tenants.id, req.params.id)).limit(1)
    if (!existing) return res.status(404).json({ error: 'Gym not found.' })

    const planChanging = updates.plan && updates.plan !== existing.plan

    // When plan changes or gym is activated: set/reset subscription_renewal_at
    if (planChanging || updates.status === 'active') {
      const renewal = new Date()
      renewal.setMonth(renewal.getMonth() + 1)
      updates.subscription_renewal_at = renewal
    }

    updates.updated_at = new Date()

    await db.update(globalSchema.tenants)
      .set(updates as any)
      .where(eq(globalSchema.tenants.id, req.params.id))

    // Send plan change email asynchronously (don't block response)
    if (planChanging && existing.owner_email) {
      const newPlanKey   = updates.plan as string
      const oldPlanLabel = PLAN_LABEL[existing.plan] ?? existing.plan
      const newPlanLabel = PLAN_LABEL[newPlanKey]    ?? newPlanKey
      const newPrice     = PLAN_PRICE_XAF[newPlanKey] ?? 0
      const renewalAt    = updates.subscription_renewal_at as Date

      sendPlanChangeEmail(
        { email: existing.owner_email, name: existing.owner_name },
        existing.slug,
        oldPlanLabel,
        newPlanLabel,
        newPrice,
        renewalAt,
      ).catch(err => console.error('[superadmin/gyms/:id PATCH] plan change email failed:', err))
    }

    res.json({ ok: true })
  } catch (err) {
    console.error('[superadmin/gyms/:id PATCH]', err)
    res.status(500).json({ error: 'Failed to update gym.' })
  }
})

superadminRouter.get('/revenue', async (req, res) => {
  try {
    const period = (req.query.period as string) ?? '30d'
    const intervalMap: Record<string, string> = { '7d': '7 days', '30d': '30 days', '90d': '90 days', '1y': '1 year' }
    const interval = intervalMap[period] ?? '30 days'

    const tenants = await db.select().from(globalSchema.tenants)
    const mrr = tenants
      .filter(t => t.status === 'active')
      .reduce((s, t) => s + (planPrices[t.plan] ?? 0), 0)

    const byPlan = Object.entries(planPrices).map(([plan, price]) => ({
      plan,
      price,
      count: tenants.filter(t => t.plan === plan && t.status === 'active').length,
      revenue: tenants.filter(t => t.plan === plan && t.status === 'active').length * price,
    }))

    // Monthly revenue within the selected period
    const { rows: monthlyRows } = await globalQuery<{ month: string; revenue: string }>(
      `SELECT TO_CHAR(DATE_TRUNC('month', period_start), 'Mon YYYY') AS month,
              COALESCE(SUM(amount_xaf), 0) AS revenue
       FROM platform_invoices
       WHERE status = 'paid' AND period_start >= NOW() - INTERVAL $1
       GROUP BY DATE_TRUNC('month', period_start)
       ORDER BY DATE_TRUNC('month', period_start) ASC`,
      [interval],
    )
    const monthly = monthlyRows.map(r => ({ month: r.month, revenue: parseInt(r.revenue) }))

    // Recent paid invoices within the selected period as transaction feed
    const { rows: txRows } = await globalQuery<{
      id: string; tenant_name: string; amount_xaf: number; status: string; paid_at: string | null; plan: string
    }>(
      `SELECT pi.id, t.name AS tenant_name, pi.amount_xaf, pi.status, pi.paid_at, pi.plan
       FROM platform_invoices pi
       JOIN tenants t ON t.id = pi.tenant_id
       WHERE pi.created_at >= NOW() - INTERVAL $1
       ORDER BY pi.created_at DESC LIMIT 20`,
      [interval],
    )

    res.json({ mrr, arr: mrr * 12, byPlan, monthly, transactions: txRows })
  } catch (err) {
    console.error('[superadmin/revenue]', err)
    res.status(500).json({ error: 'Failed to load revenue.' })
  }
})

superadminRouter.post('/users', async (req, res) => {
  try {
    const { name, email, password } = req.body
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required.' })

    const passwordHash = await bcrypt.hash(password, 12)
    const id = uuid()
    await db.insert(globalSchema.superadmins).values({
      id, name, email: email.toLowerCase(), password_hash: passwordHash,
    })
    res.status(201).json({ id, ok: true })
  } catch (err) {
    console.error('[superadmin/users POST]', err)
    res.status(500).json({ error: 'Failed to create superadmin.' })
  }
})

// ─── DELETE /api/superadmin/gyms/:id ─────────────────────────────────────────
// Soft-archive a gym (set status to cancelled, preserves data)

superadminRouter.delete('/gyms/:id', async (req, res) => {
  try {
    await db.update(globalSchema.tenants)
      .set({ status: 'cancelled', updated_at: new Date() } as Record<string, unknown>)
      .where(eq(globalSchema.tenants.id, req.params.id))
    res.json({ ok: true })
  } catch (err) {
    console.error('[superadmin/gyms/:id DELETE]', err)
    res.status(500).json({ error: 'Failed to archive gym.' })
  }
})

// ─── GET /api/superadmin/webhooks ────────────────────────────────────────────
// List recent webhook events with optional filters

superadminRouter.get('/webhooks', async (req, res) => {
  try {
    const { status, tenant_id, page = '1', limit = '50' } = req.query as Record<string, string>
    const offset = (parseInt(page) - 1) * parseInt(limit)

    const params: unknown[] = []
    const conditions: string[] = []
    if (status) { params.push(status); conditions.push(`w.status = $${params.length}`) }
    if (tenant_id) { params.push(tenant_id); conditions.push(`w.tenant_id = $${params.length}`) }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    params.push(parseInt(limit))
    const limitIdx = params.length
    params.push(offset)
    const offsetIdx = params.length

    const { rows } = await globalQuery(
      `SELECT w.*, t.name as tenant_name, t.slug as tenant_slug
       FROM webhook_events w
       LEFT JOIN tenants t ON t.id = w.tenant_id
       ${where}
       ORDER BY w.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    )
    res.json({ webhooks: rows })
  } catch (err) {
    console.error('[superadmin/webhooks]', err)
    res.status(500).json({ error: 'Failed to load webhooks.' })
  }
})

// ─── GET /api/superadmin/webhooks/:id ────────────────────────────────────────

superadminRouter.get('/webhooks/:id', async (req, res) => {
  try {
    const { rows } = await globalQuery(
      `SELECT * FROM webhook_events WHERE id = $1 LIMIT 1`,
      [req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ error: 'Webhook event not found.' })
    res.json(rows[0])
  } catch (err) {
    console.error('[superadmin/webhooks/:id]', err)
    res.status(500).json({ error: 'Failed to load webhook event.' })
  }
})

// ─── POST /api/superadmin/webhooks/:id/retry ─────────────────────────────────
// Reset a failed webhook to pending for reprocessing

superadminRouter.post('/webhooks/:id/retry', async (req, res) => {
  try {
    await globalQuery(
      `UPDATE webhook_events SET status = 'pending', processed_at = NULL WHERE id = $1`,
      [req.params.id],
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[superadmin/webhooks/:id/retry]', err)
    res.status(500).json({ error: 'Failed to retry webhook.' })
  }
})

// ─── POST /api/superadmin/impersonate/:tenantId ─────────────────────────────
// Generate an owner-level token for a given tenant (for support/debugging)

superadminRouter.post('/impersonate/:tenantId', async (req, res) => {
  try {
    const [tenant] = await db.select().from(globalSchema.tenants)
      .where(eq(globalSchema.tenants.id, req.params.tenantId)).limit(1)
    if (!tenant) return res.status(404).json({ error: 'Tenant not found.' })

    const sa = (req as any).superadmin as { sub: string } | undefined
    const token = jwt.sign(
      {
        sub: sa?.sub ?? 'superadmin',
        role: 'owner',
        tenant_id: tenant.id,
        tenant_slug: tenant.slug,
        impersonated: true,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' },
    )

    res.json({ ok: true, token, tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug } })
  } catch (err) {
    console.error('[superadmin/impersonate]', err)
    res.status(500).json({ error: 'Failed to generate impersonation token.' })
  }
})

// ─── POST /api/superadmin/gyms/:id/reset-password ───────────────────────────
// Trigger a password reset email for the gym owner

superadminRouter.post('/gyms/:id/reset-password', async (req, res) => {
  try {
    const [tenant] = await db.select().from(globalSchema.tenants)
      .where(eq(globalSchema.tenants.id, req.params.id)).limit(1)
    if (!tenant) return res.status(404).json({ error: 'Gym not found.' })

    // Reuse the auth forgot-password flow: insert a reset token and email it
    const [owner] = await db.select({ id: globalSchema.owners.id })
      .from(globalSchema.owners)
      .where(eq(globalSchema.owners.email, tenant.owner_email))
      .limit(1)
    if (!owner) return res.status(404).json({ error: 'Owner account not found.' })

    const { randomBytes } = await import('crypto')
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 3600_000) // 1 hour

    await globalQuery(
      `INSERT INTO password_resets (id, owner_id, token, expires_at, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, NOW())`,
      [owner.id, token, expiresAt],
    )

    const resetUrl = `${process.env.APP_URL}/reset-password?token=${token}`
    // Use brevo directly to send the reset email
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY!, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'myfiti', email: process.env.EMAIL_FROM ?? 'no-reply@myfiti.com' },
        to: [{ email: tenant.owner_email, name: tenant.owner_name }],
        subject: 'Reset your myfiti password',
        htmlContent: `<p>Hi ${tenant.owner_name},</p><p>A myfiti administrator has requested a password reset for your account.</p><p><a href="${resetUrl}">Reset Password</a></p><p>This link expires in 1 hour.</p>`,
      }),
    })

    res.json({ ok: true })
  } catch (err) {
    console.error('[superadmin/gyms/:id/reset-password]', err)
    res.status(500).json({ error: 'Failed to trigger password reset.' })
  }
})

// ─── POST /api/superadmin/gyms/:id/message ───────────────────────────────────
// Send a custom message to the gym owner from myfiti support

superadminRouter.post('/gyms/:id/message', async (req, res) => {
  try {
    const [tenant] = await db.select().from(globalSchema.tenants)
      .where(eq(globalSchema.tenants.id, req.params.id)).limit(1)
    if (!tenant) return res.status(404).json({ error: 'Gym not found.' })

    const { subject, body } = req.body
    if (!subject || !body) return res.status(400).json({ error: 'Subject and body are required.' })

    await sendSuperadminMessageEmail(
      { email: tenant.owner_email, name: tenant.owner_name },
      subject,
      body,
    )

    res.json({ ok: true })
  } catch (err) {
    console.error('[superadmin/gyms/:id/message]', err)
    res.status(500).json({ error: 'Failed to send message.' })
  }
})

// ─── GET /api/superadmin/webhooks ────────────────────────────────────────────

superadminRouter.get('/webhooks', async (req, res) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) ?? '100'), 500)
    const { rows } = await globalQuery<{
      id: string; provider: string; event_type: string; status: string
      payload: string; tenant_id: string | null; tenant_name: string | null
      tenant_slug: string | null; processed_at: string | null; created_at: string
    }>(
      `SELECT w.id, w.provider, w.event_type, w.status, w.payload,
              w.tenant_id, t.name AS tenant_name, t.slug AS tenant_slug,
              w.processed_at, w.created_at
       FROM webhook_events w
       LEFT JOIN tenants t ON t.id = w.tenant_id
       ORDER BY w.created_at DESC
       LIMIT $1`,
      [limit],
    )
    res.json({
      webhooks: rows.map(r => ({
        ...r,
        payload: (() => { try { return JSON.parse(r.payload) } catch { return r.payload } })(),
        response_code: null,
        attempts: null,
      })),
    })
  } catch (err) {
    console.error('[superadmin/webhooks]', err)
    res.status(500).json({ error: 'Failed to load webhooks.' })
  }
})

// ─── POST /api/superadmin/webhooks/:id/retry ─────────────────────────────────

superadminRouter.post('/webhooks/:id/retry', async (req, res) => {
  try {
    await globalQuery(
      `UPDATE webhook_events SET status = 'pending', processed_at = NULL WHERE id = $1`,
      [req.params.id],
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[superadmin/webhooks/:id/retry]', err)
    res.status(500).json({ error: 'Failed to retry webhook.' })
  }
})

// ─── GET /api/superadmin/users ───────────────────────────────────────────────
// Returns gym owners (global) + staff members (per-tenant) as a unified list

superadminRouter.get('/users', async (_req, res) => {
  try {
    // 1. Gym owners from global schema (joined with their tenant)
    const { rows: ownerRows } = await globalQuery<{
      id: string; name: string; email: string; phone: string | null
      created_at: string; tenant_id: string | null
      gym_name: string | null; gym_slug: string | null; tenant_status: string | null
    }>(
      `SELECT o.id, o.name, o.email, o.phone, o.created_at,
              o.tenant_id, t.name AS gym_name, t.slug AS gym_slug, t.status AS tenant_status
       FROM owners o
       LEFT JOIN tenants t ON t.id = o.tenant_id
       ORDER BY o.created_at DESC`,
    )

    const owners = ownerRows.map(o => ({
      id:        o.id,
      name:      o.name,
      email:     o.email,
      role:      'owner' as const,
      gymId:     o.tenant_id ?? '',
      gymName:   o.gym_name ?? '—',
      gymSlug:   o.gym_slug ?? '',
      status:    o.tenant_status === 'suspended' ? 'suspended' : 'active',
      joinedAt:  o.created_at,
    }))

    // 2. Staff from each tenant schema (best-effort, skip if schema missing)
    const tenants = await db.select({
      id: globalSchema.tenants.id, slug: globalSchema.tenants.slug, name: globalSchema.tenants.name,
    }).from(globalSchema.tenants)

    const staffByTenant = await Promise.all(
      tenants.slice(0, 50).map(async t => {
        try {
          const { rows } = await tenantQuery<{
            id: string; name: string; email: string; phone: string | null
            role: string; is_active: boolean; created_at: string
          }>(
            t.slug,
            `SELECT id, name, email, phone, role, is_active, created_at FROM staff ORDER BY created_at DESC`,
          )
          return rows.map(s => ({
            id:       `${t.id}:${s.id}`,
            name:     s.name,
            email:    s.email,
            role:     s.role,
            gymId:    t.id,
            gymName:  t.name,
            gymSlug:  t.slug,
            status:   s.is_active ? 'active' : 'inactive',
            joinedAt: s.created_at,
          }))
        } catch { return [] }
      }),
    )

    const staff = staffByTenant.flat()
    const users = [...owners, ...staff]

    res.json({
      users,
      total: users.length,
      ownerCount:    owners.length,
      staffCount:    staff.filter(s => ['admin', 'receptionist'].includes(s.role)).length,
      trainerCount:  staff.filter(s => s.role === 'trainer').length,
      suspendedCount: users.filter(u => u.status === 'suspended' || u.status === 'inactive').length,
    })
  } catch (err) {
    console.error('[superadmin/users]', err)
    res.status(500).json({ error: 'Failed to load users.' })
  }
})

// ─── POST /api/superadmin/payouts/process ────────────────────────────────────

superadminRouter.post('/payouts/process', async (_req, res) => {
  // Payouts are not yet automated — return ok so the UI doesn't error
  res.json({ ok: true, message: 'Payout processing is manual at this stage.' })
})

// ─── POST /api/superadmin/payouts/:id/release ────────────────────────────────

superadminRouter.post('/payouts/:id/release', async (_req, res) => {
  res.json({ ok: true })
})

// ─── GET /api/superadmin/audit-log ──────────────────────────────────────────
// Platform audit log — recent superadmin actions (sourced from webhook_events + tenant changes)

superadminRouter.get('/audit-log', async (req, res) => {
  try {
    const { page = '1', limit = '50' } = req.query as Record<string, string>
    const offset = (parseInt(page) - 1) * parseInt(limit)

    // Combine recent tenant status changes with webhook events as a basic audit trail
    const { rows } = await globalQuery(
      `(
        SELECT 'tenant_change' as event_type, t.id as entity_id,
               t.name as entity_name, t.status as detail,
               t.updated_at as timestamp
        FROM tenants t
        ORDER BY t.updated_at DESC
        LIMIT 50
      )
      UNION ALL
      (
        SELECT 'webhook' as event_type, w.id as entity_id,
               w.event_type as entity_name, w.status as detail,
               w.created_at as timestamp
        FROM webhook_events w
        ORDER BY w.created_at DESC
        LIMIT 50
      )
      ORDER BY timestamp DESC
      LIMIT $1 OFFSET $2`,
      [parseInt(limit), offset],
    )

    res.json({ events: rows })
  } catch (err) {
    console.error('[superadmin/audit-log]', err)
    res.status(500).json({ error: 'Failed to load audit log.' })
  }
})

// ─── GET /api/superadmin/metrics ────────────────────────────────────────────
// Cross-tenant usage metrics

superadminRouter.get('/metrics', async (_req, res) => {
  try {
    const tenants = await db.select().from(globalSchema.tenants)
    const activeTenants = tenants.filter(t => t.status === 'active' || t.status === 'trialing')

    // Gather per-tenant stats in parallel (cap at 50 to avoid overload)
    const tenantMetrics = await Promise.all(
      activeTenants.slice(0, 50).map(async t => {
        try {
          const [memberResult, checkinResult, revenueResult] = await Promise.all([
            tenantQuery<{ total: string; active: string }>(
              t.slug,
              `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM members`,
            ),
            tenantQuery<{ today: string; month: string }>(
              t.slug,
              `SELECT
                 COUNT(*) FILTER (WHERE checked_in_at >= CURRENT_DATE) as today,
                 COUNT(*) FILTER (WHERE checked_in_at >= date_trunc('month', NOW())) as month
               FROM check_ins`,
            ),
            tenantQuery<{ mtd: string }>(
              t.slug,
              `SELECT COALESCE(SUM(amount), 0) as mtd
               FROM payments
               WHERE status = 'completed' AND paid_at >= date_trunc('month', NOW())`,
            ),
          ])
          return {
            tenant_id: t.id,
            slug: t.slug,
            name: t.name,
            plan: t.plan,
            totalMembers: parseInt(memberResult.rows[0]?.total ?? '0'),
            activeMembers: parseInt(memberResult.rows[0]?.active ?? '0'),
            checkinsToday: parseInt(checkinResult.rows[0]?.today ?? '0'),
            checkinsMonth: parseInt(checkinResult.rows[0]?.month ?? '0'),
            revenueMtd: parseFloat(revenueResult.rows[0]?.mtd ?? '0'),
          }
        } catch {
          return { tenant_id: t.id, slug: t.slug, name: t.name, plan: t.plan, error: 'schema_not_ready' }
        }
      }),
    )

    res.json({ tenants: tenantMetrics })
  } catch (err) {
    console.error('[superadmin/metrics]', err)
    res.status(500).json({ error: 'Failed to load metrics.' })
  }
})

// ─── Invoice helpers ─────────────────────────────────────────────────────────

const PLAN_PRICE_XAF: Record<string, number> = {
  starter: 0, growth: 9900, growth_plus: 19900, enterprise: 49900,
}
const PLAN_LABEL: Record<string, string> = {
  starter: 'Starter', growth: 'Growth', growth_plus: 'Growth+', enterprise: 'Enterprise',
}

function invoiceNumber(tenantSlug: string, date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `INV-${y}-${m}-${tenantSlug.toUpperCase().slice(0, 6)}`
}

// ─── GET /api/superadmin/invoices ────────────────────────────────────────────

superadminRouter.get('/invoices', async (req, res) => {
  try {
    const { limit = '100', status, tenant_id } = req.query as Record<string, string>

    const params: unknown[] = []
    const conditions: string[] = []
    if (status) { params.push(status); conditions.push(`i.status = $${params.length}`) }
    if (tenant_id) { params.push(tenant_id); conditions.push(`i.tenant_id = $${params.length}`) }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    params.push(parseInt(limit))

    const { rows } = await globalQuery(
      `SELECT i.*,
              CASE i.plan
                WHEN 'starter'    THEN 'Starter'
                WHEN 'growth'     THEN 'Growth'
                WHEN 'growth_plus' THEN 'Growth+'
                WHEN 'enterprise' THEN 'Enterprise'
                ELSE i.plan
              END AS plan_label,
              t.name as tenant_name, t.slug as tenant_slug, t.owner_name, t.owner_email
       FROM platform_invoices i
       JOIN tenants t ON t.id = i.tenant_id
       ${where}
       ORDER BY i.created_at DESC
       LIMIT $${params.length}`,
      params,
    )
    res.json({ invoices: rows })
  } catch (err) {
    console.error('[superadmin/invoices]', err)
    res.status(500).json({ error: 'Failed to load invoices.' })
  }
})

// ─── POST /api/superadmin/invoices/generate ──────────────────────────────────
// Generate monthly invoices for all active/trialing paid-plan tenants.
// Idempotent — skips tenants that already have an invoice for the current period.

superadminRouter.post('/invoices/generate', async (_req, res) => {
  try {
    const result = await generateMonthlyInvoices()
    res.json({ ok: true, ...result })
  } catch (err) {
    console.error('[superadmin/invoices/generate]', err)
    res.status(500).json({ error: 'Failed to generate invoices.' })
  }
})

// ─── POST /api/superadmin/wallet/reconcile ───────────────────────────────────
// Manually trigger wallet balance reconciliation across all tenants.
// Also runs automatically every 24 hours via startWalletReconcileCron().

superadminRouter.post('/wallet/reconcile', async (_req, res) => {
  try {
    const result = await runWalletReconcile()
    res.json({ ok: true, ...result })
  } catch (err) {
    console.error('[superadmin/wallet/reconcile]', err)
    res.status(500).json({ error: 'Reconciliation failed.' })
  }
})

// ─── PATCH /api/superadmin/invoices/:id ──────────────────────────────────────
// Update invoice status (e.g. mark as paid)

superadminRouter.patch('/invoices/:id', async (req, res) => {
  try {
    const allowed = ['status', 'paid_at', 'pdf_url']
    const updates: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(req.body)) {
      if (allowed.includes(k)) updates[k] = v
    }
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update.' })

    if (updates.status === 'paid' && !updates.paid_at) updates.paid_at = new Date()
    updates.updated_at = new Date()

    const sets = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ')
    await globalQuery(
      `UPDATE platform_invoices SET ${sets} WHERE id = $1`,
      [req.params.id, ...Object.values(updates)],
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[superadmin/invoices/:id PATCH]', err)
    res.status(500).json({ error: 'Failed to update invoice.' })
  }
})

// ─── POST /api/superadmin/billing/record-cash ────────────────────────────────
// Record a cash payment from a gym to myfiti.
// Updates tenant status to active, extends renewal date, creates platform invoice,
// generates PDF and emails it to the gym owner.

superadminRouter.post('/billing/record-cash', requireSuperAuth, async (req, res) => {
  try {
    const { tenant_id, amount, currency, period_months = 1, notes } = req.body as {
      tenant_id: string; amount: number; currency?: string
      period_months?: number; notes?: string
    }

    if (!tenant_id || !amount || amount <= 0) {
      return res.status(400).json({ error: 'tenant_id and amount are required.' })
    }

    // Fetch tenant details
    const { rows } = await globalQuery<{
      id: string; name: string; owner_email: string; owner_name: string
      plan: string; status: string; currency: string; account_number: string | null
      subscription_renewal_at: string | null
    }>(
      `SELECT id, name, owner_email, owner_name, plan, status, currency, account_number, subscription_renewal_at
       FROM tenants WHERE id = $1 LIMIT 1`,
      [tenant_id],
    )
    const tenant = rows[0]
    if (!tenant) return res.status(404).json({ error: 'Tenant not found.' })

    const curr       = currency ?? tenant.currency ?? 'XAF'
    const paidAt     = new Date()
    const paidAtIso  = paidAt.toISOString()

    // Compute new renewal date: extend from current renewal or from today
    const base = tenant.subscription_renewal_at && new Date(tenant.subscription_renewal_at) > paidAt
      ? new Date(tenant.subscription_renewal_at)
      : new Date(paidAt)
    base.setMonth(base.getMonth() + Number(period_months))
    const renewalAt = base.toISOString()

    // Activate tenant + set renewal
    await globalQuery(
      `UPDATE tenants SET status = 'active', subscription_renewal_at = $1, updated_at = NOW() WHERE id = $2`,
      [renewalAt, tenant_id],
    )

    // Create invoice number
    const invNo = `MYFITI-${paidAt.getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-6)}`

    const PLAN_LABELS: Record<string, string> = {
      starter: 'myfiti Starter Plan', growth: 'myfiti Growth Plan',
      growth_plus: 'myfiti Growth+ Plan', enterprise: 'myfiti Enterprise Plan',
    }
    const planLabel = PLAN_LABELS[tenant.plan] ?? `myfiti ${tenant.plan} Plan`

    // Mark any existing pending/overdue invoice for this period as paid, or insert new
    const periodStart = new Date(); periodStart.setDate(1); periodStart.setHours(0, 0, 0, 0)
    const periodEnd   = new Date(periodStart); periodEnd.setMonth(periodEnd.getMonth() + 1)

    const { rows: existRows } = await globalQuery<{ id: string }>(
      `SELECT id FROM platform_invoices
       WHERE tenant_id = $1
         AND period_start >= $2 AND period_start < $3
         AND status IN ('pending','overdue')
       LIMIT 1`,
      [tenant_id, periodStart, periodEnd],
    )

    if (existRows[0]) {
      await globalQuery(
        `UPDATE platform_invoices
         SET status = 'paid', invoice_number = $1, amount_xaf = $2, paid_at = $3, updated_at = NOW()
         WHERE id = $4`,
        [invNo, amount, paidAtIso, existRows[0].id],
      )
    } else {
      await globalQuery(
        `INSERT INTO platform_invoices
           (id, tenant_id, invoice_number, amount_xaf, plan, period_start, period_end, due_date, status, paid_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'paid',$9,NOW(),NOW())`,
        [uuid(), tenant_id, invNo, amount, tenant.plan, periodStart, periodEnd, paidAt, paidAtIso],
      )
    }

    // Generate PDF invoice
    const pdfBuffer = await buildInvoicePDF({
      invoiceNo:   invNo,
      issuedAt:    paidAtIso,
      dueAt:       paidAtIso,
      status:      'PAID',
      gymName:     'myfiti',
      gymAddress:  'Douala, Cameroon',
      gymEmail:    'billing@myfiti.app',
      memberName:  tenant.owner_name,
      memberNo:    tenant.account_number ?? undefined,
      memberEmail: tenant.owner_email,
      items: [{ description: `${planLabel} — ${period_months} month${Number(period_months) > 1 ? 's' : ''}`, qty: Number(period_months), unitPrice: amount / Number(period_months), total: amount }],
      currency:     curr,
      subtotal:     amount,
      total:        amount,
      paymentMethod:'cash',
      paymentRef:   invNo,
      paidAt:       paidAtIso,
      qrContent:    `myfiti:invoice:${invNo}`,
    })

    // Email invoice to gym owner
    await sendInvoiceNotificationEmail({
      to:            { email: tenant.owner_email, name: tenant.owner_name },
      invoiceId:     existRows[0]?.id ?? invNo,
      invoiceNumber: invNo,
      planLabel,
      amountXaf:     amount,
      periodStart,
      periodEnd,
      dueDate:       new Date(paidAtIso),
      pdfBuffer,
    })

    res.json({ ok: true, invoice_number: invNo, renewal_at: renewalAt })
  } catch (err) {
    console.error('[superadmin/billing/record-cash]', err)
    res.status(500).json({ error: 'Failed to record cash payment.' })
  }
})

// ─── POST /api/superadmin/invoices/:id/resend ────────────────────────────────
// Regenerate the PDF and re-send the invoice notification email to the gym owner.

superadminRouter.post('/invoices/:id/resend', requireSuperAuth, async (req, res) => {
  try {
    const { rows } = await globalQuery<{
      id: string; invoice_number: string; amount_xaf: number; status: string
      plan: string; period_start: string; period_end: string; due_date: string
      paid_at: string | null; created_at: string
      tenant_name: string; tenant_slug: string; owner_name: string; owner_email: string
      account_number: string | null
    }>(
      `SELECT i.*, t.name as tenant_name, t.slug as tenant_slug,
              t.owner_name, t.owner_email, t.account_number
       FROM platform_invoices i
       JOIN tenants t ON t.id = i.tenant_id
       WHERE i.id = $1 LIMIT 1`,
      [req.params.id],
    )
    const inv = rows[0]
    if (!inv) return res.status(404).json({ error: 'Invoice not found.' })
    if (!inv.owner_email) return res.status(400).json({ error: 'No owner email for this gym.' })

    const periodStart = new Date(inv.period_start)
    const periodEnd   = new Date(inv.period_end)
    const dueDate     = new Date(inv.due_date)
    const amountXaf   = inv.amount_xaf
    const planLabel   = PLAN_LABEL[inv.plan] ?? inv.plan

    const pdfBuffer = await buildInvoicePDF({
      invoiceNo:   inv.invoice_number,
      issuedAt:    new Date(inv.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      dueAt:       dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      status:      inv.status === 'paid' ? 'PAID' : inv.status === 'overdue' ? 'OVERDUE' : 'PENDING',
      gymName:     'myfiti',
      gymEmail:    'billing@myfiti.app',
      memberName:  inv.owner_name,
      memberNo:    inv.account_number ?? undefined,
      memberEmail: inv.owner_email,
      currency:    'XAF',
      subtotal:    amountXaf,
      total:       amountXaf,
      membershipCard: false,
      items: [{
        description: `${planLabel} Plan — Monthly Subscription`,
        subtitle:    `${periodStart.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })} – ${periodEnd.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        qty:         1,
        unitPrice:   amountXaf,
        total:       amountXaf,
      }],
      qrContent: `myfiti:invoice:${inv.invoice_number}`,
      ...(inv.paid_at ? { paidAt: new Date(inv.paid_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) } : {}),
    })

    await sendInvoiceNotificationEmail({
      to:            { email: inv.owner_email, name: inv.owner_name },
      invoiceId:     inv.id,
      invoiceNumber: inv.invoice_number,
      planLabel,
      amountXaf,
      periodStart,
      periodEnd,
      dueDate,
      pdfBuffer,
    })

    console.log(`[superadmin/invoices/${inv.id}/resend] resent to ${inv.owner_email}`)
    res.json({ ok: true })
  } catch (err) {
    console.error('[superadmin/invoices/:id/resend]', err)
    res.status(500).json({ error: 'Failed to resend invoice.' })
  }
})

// ─── GET /api/superadmin/invoices/:id/pdf ────────────────────────────────────
// Stream a PDF for the given platform invoice (myfiti → gym)

superadminRouter.get('/invoices/:id/pdf', async (req, res) => {
  try {
    const { rows } = await globalQuery<{
      id: string; invoice_number: string; amount_xaf: number; status: string
      plan: string; period_start: string; period_end: string; due_date: string
      paid_at: string | null; created_at: string
      tenant_name: string; tenant_slug: string; owner_name: string; owner_email: string
      account_number: string | null
    }>(
      `SELECT i.*, t.name as tenant_name, t.slug as tenant_slug,
              t.owner_name, t.owner_email, t.account_number, t.primary_color
       FROM platform_invoices i
       JOIN tenants t ON t.id = i.tenant_id
       WHERE i.id = $1 LIMIT 1`,
      [req.params.id],
    )
    const inv = rows[0]
    if (!inv) return res.status(404).json({ error: 'Invoice not found.' })

    const statusMap: Record<string, 'PAID' | 'PENDING' | 'OVERDUE'> = {
      paid: 'PAID', overdue: 'OVERDUE',
    }

    const data: InvoiceData = {
      invoiceNo:   inv.invoice_number,
      issuedAt:    new Date(inv.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      dueAt:       new Date(inv.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      status:      statusMap[inv.status] ?? 'PENDING',
      gymName:     'myfiti',
      gymEmail:    'billing@myfiti.com',
      memberName:  inv.owner_name ?? inv.tenant_name,
      memberNo:    inv.account_number ?? undefined,
      memberEmail: inv.owner_email,
      currency:    'XAF',
      subtotal:    inv.amount_xaf,
      total:       inv.amount_xaf,
      membershipCard: false,
      items: [{
        description: `${PLAN_LABEL[inv.plan] ?? inv.plan} Plan — Monthly Subscription`,
        subtitle:    `${new Date(inv.period_start).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date(inv.period_end).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        qty:         1,
        unitPrice:   inv.amount_xaf,
        total:       inv.amount_xaf,
      }],
      qrContent: `${process.env.APP_URL ?? 'https://app.myfiti.app'}/invoices/${inv.invoice_number}`,
      ...(inv.paid_at ? { paidAt: new Date(inv.paid_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) } : {}),
    }

    const pdfBuffer = await buildInvoicePDF(data)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${inv.invoice_number}.pdf"`)
    res.send(pdfBuffer)
  } catch (err) {
    console.error('[superadmin/invoices/:id/pdf]', err)
    res.status(500).json({ error: 'Failed to generate PDF.' })
  }
})

// ─── GET /api/superadmin/support/tickets ─────────────────────────────────────
// List all support tickets with messages and tenant context

superadminRouter.get('/support/tickets', async (_req, res) => {
  try {
    const { rows: tickets } = await globalQuery<{
      id: string; subject: string; status: string; priority: string
      created_at: string; updated_at: string
      tenant_id: string | null; tenant_name: string | null; tenant_slug: string | null
      tenant_plan: string | null; tenant_status: string | null
      owner_name: string | null; owner_email: string | null
    }>(
      `SELECT st.id, st.subject, st.status, st.priority, st.created_at, st.updated_at,
              st.tenant_id, t.name AS tenant_name, t.slug AS tenant_slug,
              t.plan AS tenant_plan, t.status AS tenant_status,
              t.owner_name, t.owner_email
       FROM support_tickets st
       LEFT JOIN tenants t ON t.id = st.tenant_id
       ORDER BY
         CASE st.status WHEN 'open' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
         st.updated_at DESC`,
    )

    if (tickets.length === 0) {
      return res.json({ tickets: [] })
    }

    const ticketIds = tickets.map(t => t.id)
    const placeholders = ticketIds.map((_, i) => `$${i + 1}`).join(', ')
    const { rows: messages } = await globalQuery<{
      id: string; ticket_id: string; from_role: string; body: string; created_at: string
    }>(
      `SELECT id, ticket_id, from_role, body, created_at
       FROM support_messages
       WHERE ticket_id IN (${placeholders})
       ORDER BY created_at ASC`,
      ticketIds,
    )

    const msgByTicket = new Map<string, typeof messages>()
    for (const m of messages) {
      if (!msgByTicket.has(m.ticket_id)) msgByTicket.set(m.ticket_id, [])
      msgByTicket.get(m.ticket_id)!.push(m)
    }

    const result = tickets.map(t => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      gymId: t.tenant_id ?? '',
      gymName: t.tenant_name ?? 'Unknown',
      gymSlug: t.tenant_slug ?? '',
      gymPlan: t.tenant_plan ?? '',
      gymStatus: t.tenant_status ?? '',
      ownerName: t.owner_name ?? '',
      ownerEmail: t.owner_email ?? '',
      messages: (msgByTicket.get(t.id) ?? []).map(m => ({
        id: m.id,
        from: m.from_role,
        text: m.body,
        time: m.created_at,
      })),
    }))

    res.json({ tickets: result })
  } catch (err) {
    console.error('[superadmin/support/tickets]', err)
    res.status(500).json({ error: 'Failed to load support tickets.' })
  }
})

// ─── POST /api/superadmin/support/tickets/:id/reply ──────────────────────────
// Add a support reply to a ticket and email the gym owner

superadminRouter.post('/support/tickets/:id/reply', async (req, res) => {
  try {
    const { body } = req.body
    if (!body?.trim()) return res.status(400).json({ error: 'Reply body is required.' })

    const { rows: ticketRows } = await globalQuery<{
      id: string; subject: string; tenant_id: string | null
      owner_email: string | null; owner_name: string | null; tenant_name: string | null
    }>(
      `SELECT st.id, st.subject, st.tenant_id,
              t.owner_email, t.owner_name, t.name AS tenant_name
       FROM support_tickets st
       LEFT JOIN tenants t ON t.id = st.tenant_id
       WHERE st.id = $1 LIMIT 1`,
      [req.params.id],
    )
    if (!ticketRows[0]) return res.status(404).json({ error: 'Ticket not found.' })

    const ticket = ticketRows[0]
    const msgId = uuid()
    await globalQuery(
      `INSERT INTO support_messages (id, ticket_id, from_role, body, created_at)
       VALUES ($1, $2, 'support', $3, NOW())`,
      [msgId, req.params.id, body.trim()],
    )
    await globalQuery(
      `UPDATE support_tickets SET status = 'pending', updated_at = NOW() WHERE id = $1`,
      [req.params.id],
    )

    // Email the gym owner
    if (ticket.owner_email && ticket.owner_name) {
      await sendSupportReplyEmail(
        { email: ticket.owner_email, name: ticket.owner_name },
        ticket.subject,
        body.trim(),
        ticket.tenant_name ?? 'your gym',
      ).catch(err => console.error('[support reply email]', err))
    }

    res.json({ ok: true, messageId: msgId })
  } catch (err) {
    console.error('[superadmin/support/tickets/:id/reply]', err)
    res.status(500).json({ error: 'Failed to send reply.' })
  }
})

// ─── PATCH /api/superadmin/support/tickets/:id ───────────────────────────────
// Update ticket status or priority

superadminRouter.patch('/support/tickets/:id', async (req, res) => {
  try {
    const allowed = ['status', 'priority']
    const updates: Record<string, string> = {}
    for (const [k, v] of Object.entries(req.body)) {
      if (allowed.includes(k) && typeof v === 'string') updates[k] = v
    }
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update.' })

    updates.updated_at = new Date().toISOString()
    const sets = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ')
    await globalQuery(
      `UPDATE support_tickets SET ${sets} WHERE id = $1`,
      [req.params.id, ...Object.values(updates)],
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[superadmin/support/tickets/:id PATCH]', err)
    res.status(500).json({ error: 'Failed to update ticket.' })
  }
})

// ─── POST /api/superadmin/support/tickets ────────────────────────────────────
// Create a ticket manually from superadmin side

superadminRouter.post('/support/tickets', async (req, res) => {
  try {
    const { subject, body, tenantId, priority = 'medium' } = req.body
    if (!subject?.trim() || !body?.trim()) {
      return res.status(400).json({ error: 'Subject and body are required.' })
    }

    const ticketId = uuid()
    const msgId = uuid()

    await globalQuery(
      `INSERT INTO support_tickets (id, tenant_id, subject, status, priority, created_at, updated_at)
       VALUES ($1, $2, $3, 'open', $4, NOW(), NOW())`,
      [ticketId, tenantId ?? null, subject.trim(), priority],
    )
    await globalQuery(
      `INSERT INTO support_messages (id, ticket_id, from_role, body, created_at)
       VALUES ($1, $2, 'support', $3, NOW())`,
      [msgId, ticketId, body.trim()],
    )

    res.json({ ok: true, ticketId })
  } catch (err) {
    console.error('[superadmin/support/tickets POST]', err)
    res.status(500).json({ error: 'Failed to create ticket.' })
  }
})

// ─── Platform Settings ────────────────────────────────────────────────────────

superadminRouter.get('/settings', async (_req, res) => {
  try {
    const { rows } = await globalQuery<{ key: string; value: string }>(
      `SELECT key, value FROM platform_settings ORDER BY key`,
    )
    const settings: Record<string, string> = {}
    for (const r of rows) settings[r.key] = r.value
    res.json({ settings })
  } catch (err) {
    console.error('[superadmin/settings GET]', err)
    res.status(500).json({ error: 'Failed to load settings.' })
  }
})

superadminRouter.patch('/settings', async (req, res) => {
  try {
    const updates = req.body as Record<string, string>
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'Body must be a key-value object.' })
    }
    for (const [key, value] of Object.entries(updates)) {
      await globalQuery(
        `INSERT INTO platform_settings (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, String(value)],
      )
    }
    res.json({ ok: true })
  } catch (err) {
    console.error('[superadmin/settings PATCH]', err)
    res.status(500).json({ error: 'Failed to save settings.' })
  }
})

// ─── Feature Flags ────────────────────────────────────────────────────────────

superadminRouter.get('/flags', async (_req, res) => {
  try {
    const { rows: flags } = await globalQuery<{
      key: string; label: string; description: string | null
      group_name: string | null; risk: string; global_enabled: boolean
    }>(`SELECT key, label, description, group_name, risk, global_enabled FROM feature_flags ORDER BY group_name, key`)

    const { rows: overrides } = await globalQuery<{
      flag_key: string; tenant_id: string; enabled: boolean
    }>(`SELECT flag_key, tenant_id, enabled FROM feature_flag_overrides`)

    const overrideMap: Record<string, Record<string, boolean>> = {}
    for (const o of overrides) {
      if (!overrideMap[o.flag_key]) overrideMap[o.flag_key] = {}
      overrideMap[o.flag_key][o.tenant_id] = o.enabled
    }

    res.json({
      flags: flags.map(f => ({
        key: f.key,
        label: f.label,
        description: f.description ?? '',
        group: f.group_name ?? 'Platform',
        risk: f.risk,
        global: f.global_enabled,
        overrides: overrideMap[f.key] ?? {},
      })),
    })
  } catch (err) {
    console.error('[superadmin/flags GET]', err)
    res.status(500).json({ error: 'Failed to load flags.' })
  }
})

superadminRouter.patch('/flags/:key', async (req, res) => {
  try {
    const { global: globalEnabled } = req.body as { global: boolean }
    await globalQuery(
      `UPDATE feature_flags SET global_enabled = $1, updated_at = NOW() WHERE key = $2`,
      [globalEnabled, req.params.key],
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[superadmin/flags/:key PATCH]', err)
    res.status(500).json({ error: 'Failed to update flag.' })
  }
})

superadminRouter.post('/flags/:key/override', async (req, res) => {
  try {
    const { tenantId, enabled } = req.body as { tenantId: string; enabled: boolean }
    if (!tenantId) return res.status(400).json({ error: 'tenantId required.' })
    await globalQuery(
      `INSERT INTO feature_flag_overrides (flag_key, tenant_id, enabled)
       VALUES ($1, $2, $3)
       ON CONFLICT (flag_key, tenant_id) DO UPDATE SET enabled = $3`,
      [req.params.key, tenantId, enabled ?? true],
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[superadmin/flags/:key/override POST]', err)
    res.status(500).json({ error: 'Failed to set override.' })
  }
})

superadminRouter.delete('/flags/:key/override/:tenantId', async (req, res) => {
  try {
    await globalQuery(
      `DELETE FROM feature_flag_overrides WHERE flag_key = $1 AND tenant_id = $2`,
      [req.params.key, req.params.tenantId],
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[superadmin/flags/:key/override/:tenantId DELETE]', err)
    res.status(500).json({ error: 'Failed to remove override.' })
  }
})

// ─── Announcements ────────────────────────────────────────────────────────────

superadminRouter.get('/announcements', async (_req, res) => {
  try {
    const { rows } = await globalQuery<{
      id: string; title: string; message: string
      audience: string; channels: string; sent_to: number; created_at: string
    }>(`SELECT id, title, message, audience, channels, sent_to, created_at FROM announcements ORDER BY created_at DESC LIMIT 50`)
    res.json({ announcements: rows })
  } catch (err) {
    console.error('[superadmin/announcements GET]', err)
    res.status(500).json({ error: 'Failed to load announcements.' })
  }
})

superadminRouter.post('/announcements', async (req, res) => {
  try {
    const { title, message, audience = 'all', channels = 'email' } = req.body as {
      title: string; message: string; audience?: string; channels?: string
    }
    if (!title?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'Title and message are required.' })
    }

    // Fetch recipients based on audience
    const tenants = await db.select().from(globalSchema.tenants)
    const recipients = tenants.filter(t => {
      if (audience === 'all') return true
      if (audience === 'active') return t.status === 'active'
      if (audience === 'trial') return t.status === 'trialing'
      if (audience === 'paid') return t.status === 'active' && t.plan !== 'starter'
      return true
    })

    const id = uuid()
    await globalQuery(
      `INSERT INTO announcements (id, title, message, audience, channels, sent_to, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [id, title.trim(), message.trim(), audience, channels, recipients.length],
    )

    // Fan-out emails asynchronously (don't block response)
    if (channels.includes('email')) {
      Promise.allSettled(
        recipients.map(t =>
          sendAnnouncementEmail(
            { email: t.owner_email, name: t.owner_name },
            title.trim(),
            message.trim(),
            t.name,
          ),
        ),
      ).then(results => {
        const failed = results.filter(r => r.status === 'rejected').length
        if (failed > 0) console.warn(`[announcements] ${failed} email(s) failed to send`)
      })
    }

    res.json({ ok: true, id, sentTo: recipients.length })
  } catch (err) {
    console.error('[superadmin/announcements POST]', err)
    res.status(500).json({ error: 'Failed to send announcement.' })
  }
})

// ─── Sessions ─────────────────────────────────────────────────────────────────

superadminRouter.get('/sessions', async (req, res) => {
  try {
    const { rows } = await globalQuery<{
      id: string; user_id: string; user_name: string | null; user_email: string | null
      role: string; tenant_id: string | null; tenant_name: string | null; tenant_slug: string | null
      ip_address: string | null; device: string | null; browser: string | null
      created_at: string; last_active_at: string; expires_at: string | null; terminated: boolean
    }>(
      `SELECT * FROM user_sessions
       WHERE terminated = FALSE AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC
       LIMIT 200`,
    )
    const currentSub = (req as any).superadmin?.sub as string | undefined
    res.json({
      sessions: rows.map(s => ({ ...s, current: s.user_id === currentSub && s.role === 'superadmin' })),
    })
  } catch (err) {
    console.error('[superadmin/sessions GET]', err)
    res.status(500).json({ error: 'Failed to load sessions.' })
  }
})

superadminRouter.delete('/sessions/:id', async (req, res) => {
  try {
    await globalQuery(
      `UPDATE user_sessions SET terminated = TRUE WHERE id = $1`,
      [req.params.id],
    )
    // Add to Redis blocklist so future requests with this session JWT are rejected fast
    await redis.set(`session:terminated:${req.params.id}`, '1', { ex: 60 * 60 * 24 })
    res.json({ ok: true })
  } catch (err) {
    console.error('[superadmin/sessions/:id DELETE]', err)
    res.status(500).json({ error: 'Failed to terminate session.' })
  }
})

superadminRouter.delete('/sessions', async (req, res) => {
  try {
    const currentSub = (req as any).superadmin?.sub as string | undefined
    const { rows } = await globalQuery<{ id: string }>(
      `UPDATE user_sessions SET terminated = TRUE
       WHERE terminated = FALSE
         AND NOT (user_id = $1 AND role = 'superadmin')
       RETURNING id`,
      [currentSub ?? ''],
    )
    // Blocklist all terminated session IDs in Redis
    await Promise.all(rows.map(r => redis.set(`session:terminated:${r.id}`, '1', { ex: 60 * 60 * 24 })))
    res.json({ ok: true, terminated: rows.length })
  } catch (err) {
    console.error('[superadmin/sessions DELETE]', err)
    res.status(500).json({ error: 'Failed to terminate sessions.' })
  }
})

// ─── Analytics ────────────────────────────────────────────────────────────────

superadminRouter.get('/analytics', async (_req, res) => {
  try {
    // Monthly MRR from paid platform invoices (last 12 months)
    const { rows: mrrRows } = await globalQuery<{ month: string; mrr: string }>(
      `SELECT TO_CHAR(DATE_TRUNC('month', period_start), 'Mon') AS month,
              COALESCE(SUM(amount_xaf), 0) AS mrr
       FROM platform_invoices
       WHERE status = 'paid' AND period_start >= NOW() - INTERVAL '12 months'
       GROUP BY DATE_TRUNC('month', period_start)
       ORDER BY DATE_TRUNC('month', period_start) ASC`,
    )

    // Churn by month: tenants updated to suspended/cancelled per month (last 6 months)
    const { rows: churnRows } = await globalQuery<{
      month: string; churned: string; total_at_start: string
    }>(
      `SELECT TO_CHAR(DATE_TRUNC('month', updated_at), 'Mon') AS month,
              COUNT(*) FILTER (WHERE status IN ('suspended','cancelled')) AS churned,
              COUNT(*) AS total_at_start
       FROM tenants
       WHERE updated_at >= NOW() - INTERVAL '6 months'
       GROUP BY DATE_TRUNC('month', updated_at)
       ORDER BY DATE_TRUNC('month', updated_at) ASC`,
    )

    // Cohort: group tenants by their creation month, show retention by current status
    const { rows: cohortRows } = await globalQuery<{
      cohort: string; size: string; active: string; plan: string
    }>(
      `SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') AS cohort,
              COUNT(*) AS size,
              COUNT(*) FILTER (WHERE status = 'active') AS active,
              mode() WITHIN GROUP (ORDER BY plan) AS plan
       FROM tenants
       GROUP BY DATE_TRUNC('month', created_at)
       ORDER BY DATE_TRUNC('month', created_at) ASC
       LIMIT 12`,
    )

    // Total members across all tenants (best-effort)
    const tenants = await db.select({
      id: globalSchema.tenants.id, slug: globalSchema.tenants.slug,
    }).from(globalSchema.tenants).limit(50)

    const memberCounts = await Promise.all(
      tenants.map(async t => {
        try {
          const { rows } = await tenantQuery<{ cnt: string }>(t.slug, `SELECT COUNT(*) as cnt FROM members`)
          return parseInt(rows[0]?.cnt ?? '0')
        } catch { return 0 }
      }),
    )
    const totalMembers = memberCounts.reduce((a, b) => a + b, 0)

    res.json({
      mrrHistory: mrrRows.map(r => ({ month: r.month, mrr: parseInt(r.mrr) })),
      churnByMonth: churnRows.map(r => ({
        month: r.month,
        churned: parseInt(r.churned),
        retained: parseInt(r.total_at_start) - parseInt(r.churned),
      })),
      cohorts: cohortRows.map(r => ({
        cohort: r.cohort,
        size: parseInt(r.size),
        retentionPct: parseInt(r.size) > 0 ? Math.round((parseInt(r.active) / parseInt(r.size)) * 100) : 0,
        plan: r.plan,
      })),
      totalMembers,
    })
  } catch (err) {
    console.error('[superadmin/analytics]', err)
    res.status(500).json({ error: 'Failed to load analytics.' })
  }
})

// ─── Plans Config ─────────────────────────────────────────────────────────────

superadminRouter.get('/plans/config', async (_req, res) => {
  try {
    const { rows } = await globalQuery<{ value: string }>(
      `SELECT value FROM platform_settings WHERE key = 'plans_config' LIMIT 1`,
    )
    const config = rows[0]?.value ? JSON.parse(rows[0].value) : {
      starter: { price: 0, trialDays: 14 },
      growth: { price: 9900, trialDays: 14 },
      growth_plus: { price: 19900, trialDays: 14 },
      enterprise: { price: 49900, trialDays: 14 },
    }
    res.json({ config })
  } catch (err) {
    console.error('[superadmin/plans/config GET]', err)
    res.status(500).json({ error: 'Failed to load plans config.' })
  }
})

superadminRouter.patch('/plans/config', async (req, res) => {
  try {
    const config = req.body
    await globalQuery(
      `INSERT INTO platform_settings (key, value, updated_at) VALUES ('plans_config', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(config)],
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[superadmin/plans/config PATCH]', err)
    res.status(500).json({ error: 'Failed to save plans config.' })
  }
})

// ─── Payouts history ──────────────────────────────────────────────────────────

superadminRouter.get('/payouts/history', async (_req, res) => {
  try {
    const { rows } = await globalQuery<{
      period: string; gross: string; gyms: string; status: string
    }>(
      `SELECT TO_CHAR(DATE_TRUNC('month', period_start), 'Mon YYYY') AS period,
              COALESCE(SUM(amount_xaf), 0) AS gross,
              COUNT(DISTINCT tenant_id) AS gyms,
              'paid' AS status
       FROM platform_invoices
       WHERE status = 'paid'
       GROUP BY DATE_TRUNC('month', period_start)
       ORDER BY DATE_TRUNC('month', period_start) DESC
       LIMIT 12`,
    )

    const PLATFORM_FEE = 0.15
    res.json({
      history: rows.map(r => {
        const gross = parseInt(r.gross)
        const fees  = Math.round(gross * PLATFORM_FEE)
        return {
          period:  r.period,
          gross,
          fees,
          net:     gross - fees,
          gyms:    parseInt(r.gyms),
          status:  r.status,
        }
      }),
    })
  } catch (err) {
    console.error('[superadmin/payouts/history]', err)
    res.status(500).json({ error: 'Failed to load payout history.' })
  }
})
