import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import bcrypt from 'bcrypt'
import Expo from 'expo-server-sdk'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { tenantQuery, globalQuery, db, globalSchema, eq } from '../db/client.js'
import { validate } from '../middleware/validate.js'
import { createStaffSchema } from '../schemas.js'
import { sendNewTicketEmail, sendAnnouncementEmail, sendStaffInviteEmail } from '../lib/email.js'

const expo = new Expo()

const PLAN_PRICE_XAF: Record<string, number> = {
  starter: 0, growth: 9900, growth_plus: 19900, enterprise: 49900,
}

export const settingsRouter = Router()

// ─── GET /api/settings/public ────────────────────────────────────────────────
// Basic gym info for the kiosk — no auth required.
// Tenant resolved from X-Tenant-Slug header passed by the kiosk page.

settingsRouter.get('/public', async (req, res) => {
  try {
    const { rows } = await tenantQuery(
      req.tenant.slug,
      `SELECT gym_name, primary_color, logo_url, timezone, currency FROM gym_settings WHERE id = 'singleton' LIMIT 1`,
    )
    const s = rows[0] as Record<string, unknown> | undefined
    res.json({
      gym_name:      s?.gym_name      ?? 'Gymflow',
      primary_color: s?.primary_color ?? '#6366f1',
      logo_url:      s?.logo_url      ?? null,
      timezone:      s?.timezone      ?? 'Africa/Douala',
      currency:      s?.currency      ?? 'XAF',
    })
  } catch (err) {
    console.error('[settings/public GET]', err)
    // Always return something — kiosk must not crash on settings failure
    res.json({ gym_name: 'Gymflow', primary_color: '#6366f1', logo_url: null, timezone: 'Africa/Douala', currency: 'XAF' })
  }
})

settingsRouter.use(requireAuth)
settingsRouter.use(requireRole('owner', 'admin'))

// ─── GET /api/settings ────────────────────────────────────────────────────────
// Returns gym settings + tenant plan info

settingsRouter.get('/', async (req, res) => {
  try {
    const { rows } = await tenantQuery(
      req.tenant.slug,
      `SELECT * FROM gym_settings WHERE id = 'singleton' LIMIT 1`,
    )
    res.json({
      ...(rows[0] as object ?? {}),
      plan: req.tenant.plan,
      status: req.tenant.status,
      trial_ends_at: req.tenant.trial_ends_at,
      subscription_renewal_at: req.tenant.subscription_renewal_at ?? null,
    })
  } catch (err) {
    console.error('[settings GET]', err)
    res.status(500).json({ error: 'Failed to load settings.' })
  }
})

// ─── GET /api/settings/billing/invoices ──────────────────────────────────────
// Returns all platform invoices for this tenant (myfiti → gym billing).

settingsRouter.get('/billing/invoices', async (req, res) => {
  try {
    const { rows } = await globalQuery<{
      id: string; invoice_number: string; amount_xaf: number; status: string
      plan: string; period_start: string; period_end: string; due_date: string; paid_at: string | null
    }>(
      `SELECT id, invoice_number, amount_xaf, status, plan, period_start, period_end, due_date, paid_at
       FROM platform_invoices
       WHERE tenant_id = $1
       ORDER BY period_start DESC`,
      [req.tenant.id],
    )
    res.json({ invoices: rows })
  } catch (err) {
    console.error('[settings/billing/invoices GET]', err)
    res.status(500).json({ error: 'Failed to load invoices.' })
  }
})

// ─── POST /api/settings/billing/initiate-payment ─────────────────────────────
// Initiate a Tranzak MoMo payment for the gym's myfiti platform subscription.
// Uses global Tranzak credentials (the gym pays myfiti, not per-tenant flow).

settingsRouter.post('/billing/initiate-payment', async (req, res) => {
  try {
    const tenantId   = req.tenant.id
    const tenantSlug = req.tenant.slug
    const plan       = req.tenant.plan
    const amount     = PLAN_PRICE_XAF[plan] ?? 0

    if (amount === 0) {
      return res.status(400).json({ error: 'No payment required for free plan.' })
    }

    const appId  = process.env.TRANZAK_APP_ID
    const appKey = process.env.TRANZAK_APP_KEY
    if (!appId || !appKey) {
      return res.status(503).json({ error: 'Payment provider not configured. Please contact support.' })
    }
    const mchTransactionRef = `ten-${tenantId}-${Date.now()}`
    const BASE_URL = process.env.TRANZAK_ENV === 'live' ? 'https://dsapi.tranzak.me' : 'https://sandbox.dsapi.tranzak.me'
    const APP_URL = process.env.APP_URL ?? 'https://app.myfiti.app'

    // Auth
    const authRes = await fetch(`${BASE_URL}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId, appKey }),
    })
    if (!authRes.ok) throw new Error('Tranzak auth failed')
    const authBody = await authRes.json() as { data?: { token: string }; token?: string }
    const token = authBody.data?.token ?? authBody.token
    if (!token) throw new Error('Tranzak auth: no token in response')

    // Create payment
    const paymentRes = await fetch(`${BASE_URL}/xp021/v1/request/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        amount,
        currencyCode: req.tenant.currency ?? 'XAF',
        description: `myfiti ${plan} Plan — ${tenantSlug}`,
        mchTransactionRef,
        returnUrl: `${APP_URL}/payment/callback`,
        callbackUrl: `${process.env.API_URL ?? 'https://api.myfiti.app'}/api/webhooks/tranzak?tenant=${tenantSlug}`,
        customData: { tenant_id: tenantId },
      }),
    })
    if (!paymentRes.ok) {
      const errText = await paymentRes.text()
      throw new Error(`Tranzak create error: ${errText}`)
    }
    const paymentData = await paymentRes.json() as { data?: { links?: { paymentAuthUrl?: string } } }
    const paymentUrl  = paymentData?.data?.links?.paymentAuthUrl ?? ''

    res.json({ ok: true, payment_url: paymentUrl, amount, currency: req.tenant.currency ?? 'XAF' })
  } catch (err) {
    console.error('[settings/billing/initiate-payment]', err)
    res.status(500).json({ error: 'Failed to initiate payment.' })
  }
})

// ─── PATCH /api/settings/billing/plan ────────────────────────────────────────
// Change the gym's myfiti subscription plan. Owner only.

settingsRouter.patch('/billing/plan', requireRole('owner'), async (req, res) => {
  try {
    const { plan } = req.body as { plan?: string }
    const validPlans = ['starter', 'growth', 'growth_plus', 'enterprise']
    if (!plan || !validPlans.includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Choose: starter, growth, growth_plus, or enterprise.' })
    }
    if (plan === req.tenant.plan) {
      return res.status(400).json({ error: 'You are already on this plan.' })
    }

    const prevPlan = req.tenant.plan
    const newAmount = PLAN_PRICE_XAF[plan] ?? 0

    // Update tenant plan
    await db.update(globalSchema.tenants)
      .set({ plan: plan as 'starter' | 'growth' | 'growth_plus' | 'enterprise', updated_at: new Date() })
      .where(eq(globalSchema.tenants.id, req.tenant.id))

    // If upgrading to a paid plan, generate a pending invoice for this month
    if (newAmount > 0) {
      const invoiceId = uuid()
      const now = new Date()
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      const invoiceNum = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${invoiceId.slice(0, 6).toUpperCase()}`
      await globalQuery(
        `INSERT INTO platform_invoices (id, tenant_id, invoice_number, amount_xaf, plan, status, period_start, period_end, due_date, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $7, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [invoiceId, req.tenant.id, invoiceNum, newAmount, plan, now.toISOString().slice(0, 10), periodEnd.toISOString().slice(0, 10)],
      )
    }

    console.log(`[settings/billing/plan] Tenant ${req.tenant.slug}: ${prevPlan} → ${plan}`)
    return res.json({ ok: true, plan, message: plan === 'starter' ? 'Downgraded to Starter.' : `Upgraded to ${plan} plan.` })
  } catch (err) {
    console.error('[settings/billing/plan PATCH]', err)
    return res.status(500).json({ error: 'Failed to change plan.' })
  }
})

// ─── POST /api/settings/staff/:id/resend-invite ───────────────────────────────
// Re-send invitation email to a staff member

settingsRouter.post('/staff/:id/resend-invite', async (req, res) => {
  try {
    const { id } = req.params
    const { rows } = await tenantQuery<{ id: string; name: string; email: string; role: string }>(
      req.tenant.slug,
      `SELECT id, name, email, role FROM staff WHERE id = $1 LIMIT 1`,
      [id],
    )
    const member = rows[0]
    if (!member) return res.status(404).json({ error: 'Staff member not found.' })

    const APP_URL = process.env.APP_URL ?? 'https://app.myfiti.app'
    await sendStaffInviteEmail(
      { email: member.email, name: member.name },
      req.tenant.name,
      member.role,
      `${APP_URL}/login`,
    )

    return res.json({ ok: true })
  } catch (err) {
    console.error('[settings/staff/:id/resend-invite POST]', err)
    return res.status(500).json({ error: 'Failed to resend invite.' })
  }
})

// ─── GET /api/settings/me ─────────────────────────────────────────────────────
// Returns the currently authenticated staff member's profile

settingsRouter.get('/me', async (req, res) => {
  try {
    const { rows } = await tenantQuery(
      req.tenant.slug,
      `SELECT id, name, email, phone, role, avatar_url FROM staff WHERE id = $1 LIMIT 1`,
      [req.auth.sub],
    )
    if (!rows[0]) return res.status(404).json({ error: 'Staff not found.' })
    res.json(rows[0])
  } catch (err) {
    console.error('[settings/me GET]', err)
    res.status(500).json({ error: 'Failed to load profile.' })
  }
})

// ─── GET/PATCH /api/settings/profile ─────────────────────────────────────────
// Extended gym profile fields (address, hours, social, etc.) stored in features JSONB

settingsRouter.get('/profile', async (req, res) => {
  try {
    const { rows } = await tenantQuery(req.tenant.slug, `SELECT * FROM gym_settings WHERE id = 'singleton' LIMIT 1`)
    const row = rows[0] as Record<string, unknown> ?? {}
    const features = (row.features ?? {}) as Record<string, unknown>
    res.json({
      gym_name: row.gym_name ?? '',
      country:  row.country ?? 'CM',
      timezone: row.timezone ?? 'Africa/Douala',
      currency: row.currency ?? 'XAF',
      logo_url: row.logo_url ?? null,
      primary_color: row.primary_color ?? '#6366f1',
      ...(features.profile as object ?? {}),
    })
  } catch (err) {
    console.error('[settings/profile GET]', err)
    res.status(500).json({ error: 'Failed to load profile.' })
  }
})

settingsRouter.patch('/profile', async (req, res) => {
  try {
    const { gym_name, country, timezone, currency, logo_url, primary_color, ...profileFields } = req.body as Record<string, unknown>
    const directFields: Record<string, unknown> = {}
    if (gym_name) directFields.gym_name = gym_name
    if (country) directFields.country = country
    if (timezone) directFields.timezone = timezone
    if (currency) directFields.currency = currency
    if (logo_url !== undefined) directFields.logo_url = logo_url
    if (primary_color) directFields.primary_color = primary_color

    const params: unknown[] = []
    const sets: string[] = ['updated_at = NOW()']
    for (const [k, v] of Object.entries(directFields)) {
      params.push(v ?? null)
      sets.push(`${k} = $${params.length}`)
    }

    // Store extended profile fields in features.profile JSONB sub-key
    if (Object.keys(profileFields).length > 0) {
      params.push(JSON.stringify({ profile: profileFields }))
      sets.push(`features = COALESCE(features, '{}'::jsonb) || $${params.length}::jsonb`)
    }

    if (params.length === 0) return res.status(400).json({ error: 'Nothing to update.' })

    await tenantQuery(
      req.tenant.slug,
      `INSERT INTO gym_settings (id, gym_name, slug, country, timezone, currency, updated_at)
       VALUES ('singleton', 'My Gym', $${params.length + 1}, 'CM', 'Africa/Douala', 'XAF', NOW())
       ON CONFLICT (id) DO UPDATE SET ${sets.join(', ')}`,
      [...params, req.tenant.slug],
    )

    // Mirror some fields to global tenant record
    const tenantUpdates: Record<string, unknown> = {}
    if (timezone) tenantUpdates.timezone = timezone
    if (currency) tenantUpdates.currency = currency
    if (logo_url) tenantUpdates.logo_url = logo_url
    if (primary_color) tenantUpdates.primary_color = primary_color
    if (Object.keys(tenantUpdates).length) {
      await db.update(globalSchema.tenants)
        .set({ ...tenantUpdates as Record<string, string>, updated_at: new Date() })
        .where(eq(globalSchema.tenants.id, req.tenant.id))
    }

    res.json({ ok: true })
  } catch (err) {
    console.error('[settings/profile PATCH]', err)
    res.status(500).json({ error: 'Failed to update profile.' })
  }
})

// ─── GET/PATCH /api/settings/notifications ────────────────────────────────────

settingsRouter.get('/notifications', async (req, res) => {
  try {
    const { rows } = await tenantQuery(req.tenant.slug, `SELECT features FROM gym_settings WHERE id = 'singleton' LIMIT 1`)
    const features = ((rows[0] as { features?: Record<string, unknown> })?.features ?? {})
    res.json({ notifications: features.notifications ?? {} })
  } catch (err) {
    console.error('[settings/notifications GET]', err)
    res.status(500).json({ error: 'Failed to load notification settings.' })
  }
})

settingsRouter.patch('/notifications', async (req, res) => {
  try {
    const prefs = req.body
    await tenantQuery(
      req.tenant.slug,
      `INSERT INTO gym_settings (id, gym_name, slug, country, timezone, currency, features, updated_at)
       VALUES ('singleton', 'My Gym', $1, 'CM', 'Africa/Douala', 'XAF', $2::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET
         features = COALESCE(gym_settings.features, '{}'::jsonb) || $2::jsonb,
         updated_at = NOW()`,
      [req.tenant.slug, JSON.stringify({ notifications: prefs })],
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[settings/notifications PATCH]', err)
    res.status(500).json({ error: 'Failed to save notification settings.' })
  }
})

// ─── GET/PATCH /api/settings/integrations ────────────────────────────────────

settingsRouter.get('/integrations', async (req, res) => {
  try {
    const { rows } = await tenantQuery(req.tenant.slug, `SELECT features FROM gym_settings WHERE id = 'singleton' LIMIT 1`)
    const features = ((rows[0] as { features?: Record<string, unknown> })?.features ?? {})
    res.json({ integrations: features.integrations ?? {} })
  } catch (err) {
    console.error('[settings/integrations GET]', err)
    res.status(500).json({ error: 'Failed to load integrations.' })
  }
})

settingsRouter.patch('/integrations', async (req, res) => {
  try {
    const { id, connected, enabled, ...credentials } = req.body as { id: string; connected: boolean; enabled: boolean; [k: string]: unknown }
    if (!id) return res.status(400).json({ error: 'Integration id required.' })

    const { rows } = await tenantQuery(req.tenant.slug, `SELECT features FROM gym_settings WHERE id = 'singleton' LIMIT 1`)
    const features = ((rows[0] as { features?: Record<string, unknown> })?.features ?? {}) as Record<string, unknown>
    const existing = (features.integrations ?? {}) as Record<string, unknown>
    const updated = { ...existing, [id]: { connected, enabled, ...credentials } }

    await tenantQuery(
      req.tenant.slug,
      `INSERT INTO gym_settings (id, gym_name, slug, country, timezone, currency, features, updated_at)
       VALUES ('singleton', 'My Gym', $1, 'CM', 'Africa/Douala', 'XAF', $2::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET
         features = COALESCE(gym_settings.features, '{}'::jsonb) || $2::jsonb,
         updated_at = NOW()`,
      [req.tenant.slug, JSON.stringify({ integrations: updated })],
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[settings/integrations PATCH]', err)
    res.status(500).json({ error: 'Failed to update integration.' })
  }
})

// ─── POST /api/settings/export ────────────────────────────────────────────────
// Export all gym data as JSON

settingsRouter.post('/export', async (req, res) => {
  try {
    const slug = req.tenant.slug
    const [members, payments, subscriptions, checkins, plans] = await Promise.all([
      tenantQuery(slug, `SELECT id, name, email, phone, status, joined_at, created_at FROM members ORDER BY created_at`),
      tenantQuery(slug, `SELECT p.id, m.name as member_name, p.amount, p.currency, p.provider, p.status, p.payment_type, p.paid_at FROM payments p JOIN members m ON m.id = p.member_id ORDER BY p.created_at`),
      tenantQuery(slug, `SELECT s.id, m.name as member_name, pl.name as plan_name, s.status, s.started_at, s.expires_at FROM subscriptions s JOIN members m ON m.id = s.member_id JOIN membership_plans pl ON pl.id = s.plan_id ORDER BY s.created_at`),
      tenantQuery(slug, `SELECT ci.id, m.name as member_name, ci.method, ci.checked_in_at FROM check_ins ci JOIN members m ON m.id = ci.member_id ORDER BY ci.checked_in_at`),
      tenantQuery(slug, `SELECT id, name, price, currency, duration_days, cycle, is_active FROM membership_plans ORDER BY created_at`),
    ])

    const exportData = {
      exported_at: new Date().toISOString(),
      gym: req.tenant.name,
      members: members.rows,
      payments: payments.rows,
      subscriptions: subscriptions.rows,
      checkins: checkins.rows,
      plans: plans.rows,
    }

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename=gymdata-${slug}-${new Date().toISOString().slice(0,10)}.json`)
    res.send(JSON.stringify(exportData, null, 2))
  } catch (err) {
    console.error('[settings/export POST]', err)
    res.status(500).json({ error: 'Export failed.' })
  }
})

// ─── DELETE /api/settings/data ────────────────────────────────────────────────
// Reset all gym data (members, payments, subscriptions, check-ins)
// Owner-only

settingsRouter.delete('/data', requireRole('owner'), async (req, res) => {
  try {
    const { confirm } = req.body as { confirm?: string }
    if (confirm !== 'RESET') return res.status(400).json({ error: 'Confirmation required.' })
    const slug = req.tenant.slug
    await tenantQuery(slug, `DELETE FROM check_ins`)
    await tenantQuery(slug, `DELETE FROM notifications WHERE member_id IS NOT NULL`)
    await tenantQuery(slug, `DELETE FROM payments`)
    await tenantQuery(slug, `DELETE FROM subscriptions`)
    await tenantQuery(slug, `DELETE FROM members`)
    res.json({ ok: true })
  } catch (err) {
    console.error('[settings/data DELETE]', err)
    res.status(500).json({ error: 'Reset failed.' })
  }
})

// ─── DELETE /api/settings/account ─────────────────────────────────────────────
// Close gym account

settingsRouter.delete('/account', requireRole('owner'), async (req, res) => {
  try {
    const { confirm } = req.body as { confirm?: string }
    if (!confirm) return res.status(400).json({ error: 'Confirmation required.' })
    await db.update(globalSchema.tenants)
      .set({ status: 'cancelled', updated_at: new Date() })
      .where(eq(globalSchema.tenants.id, req.tenant.id))
    res.json({ ok: true })
  } catch (err) {
    console.error('[settings/account DELETE]', err)
    res.status(500).json({ error: 'Account deletion failed.' })
  }
})

// ─── PATCH /api/settings ──────────────────────────────────────────────────────
// Update gym settings (legacy — kept for billing page and other existing callers)

settingsRouter.patch('/', async (req, res) => {
  try {
    const allowed = ['gym_name', 'country', 'timezone', 'currency', 'logo_url', 'primary_color', 'grace_period_days', 'features']
    const fields = req.body as Record<string, unknown>

    const params: unknown[] = []
    const sets: string[] = ['updated_at = NOW()']
    for (const [k, v] of Object.entries(fields)) {
      if (!allowed.includes(k)) continue
      if (k === 'features') {
        params.push(JSON.stringify(v))
        sets.push(`features = COALESCE(features, '{}'::jsonb) || $${params.length}::jsonb`)
      } else {
        params.push(v ?? null)
        sets.push(`${k} = $${params.length}`)
      }
    }
    if (params.length === 0) return res.status(400).json({ error: 'Nothing to update.' })

    // Upsert gym_settings
    params.push(req.tenant.slug)
    const slugIdx = params.length
    await tenantQuery(
      req.tenant.slug,
      `INSERT INTO gym_settings (id, gym_name, slug, country, timezone, currency, updated_at)
       VALUES ('singleton', 'My Gym', $${slugIdx}, 'CM', 'Africa/Douala', 'XAF', NOW())
       ON CONFLICT (id) DO UPDATE SET ${sets.join(', ')}`,
      params,
    )

    // Also update global tenant record for the fields that overlap
    const tenantUpdates: Record<string, unknown> = {}
    if (fields.timezone) tenantUpdates.timezone = fields.timezone
    if (fields.currency) tenantUpdates.currency = fields.currency
    if (fields.logo_url) tenantUpdates.logo_url = fields.logo_url
    if (fields.primary_color) tenantUpdates.primary_color = fields.primary_color
    if (Object.keys(tenantUpdates).length) {
      await db.update(globalSchema.tenants)
        .set({ ...tenantUpdates as Record<string, string>, updated_at: new Date() })
        .where(eq(globalSchema.tenants.id, req.tenant.id))
    }

    res.json({ ok: true })
  } catch (err) {
    console.error('[settings PATCH]', err)
    res.status(500).json({ error: 'Failed to update settings.' })
  }
})

// ─── GET/PUT /api/settings/day-pass-pricing ───────────────────────────────────
// Read and update per-tenant day pass prices stored in gym_settings.features

settingsRouter.get('/day-pass-pricing', async (req, res) => {
  try {
    const { rows } = await tenantQuery<{ features: Record<string, unknown> }>(
      req.tenant.slug,
      `SELECT features FROM gym_settings WHERE id = 'singleton' LIMIT 1`,
    )
    const pricing = (rows[0]?.features?.day_pass_pricing as Record<string, number> | undefined) ?? null
    res.json({ pricing })
  } catch (err) {
    console.error('[settings/day-pass-pricing GET]', err)
    res.status(500).json({ error: 'Failed to load day pass pricing.' })
  }
})

settingsRouter.put('/day-pass-pricing', async (req, res) => {
  try {
    const pricing = req.body as Record<string, unknown>
    // Validate: all values must be positive numbers
    for (const [k, v] of Object.entries(pricing)) {
      if (typeof v !== 'number' || v < 0) {
        return res.status(400).json({ error: `Invalid price for "${k}": must be a non-negative number.` })
      }
    }
    await tenantQuery(
      req.tenant.slug,
      `INSERT INTO gym_settings (id, gym_name, slug, country, timezone, currency, features, updated_at)
       VALUES ('singleton', 'My Gym', $1, 'CM', 'Africa/Douala', 'XAF', $2::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET
         features   = COALESCE(gym_settings.features, '{}'::jsonb) || jsonb_build_object('day_pass_pricing', $2::jsonb),
         updated_at = NOW()`,
      [req.tenant.slug, JSON.stringify(pricing)],
    )
    res.json({ ok: true, pricing })
  } catch (err) {
    console.error('[settings/day-pass-pricing PUT]', err)
    res.status(500).json({ error: 'Failed to save day pass pricing.' })
  }
})

// ─── GET /api/settings/staff ──────────────────────────────────────────────────

settingsRouter.get('/staff', async (req, res) => {
  try {
    const { rows } = await tenantQuery(
      req.tenant.slug,
      `SELECT s.id, s.name, s.email, s.phone, s.role, s.avatar_url, s.is_active, s.created_at,
              (s.pin_hash IS NOT NULL) AS has_pin,
              CASE WHEN s.role = 'trainer' THEN (
                SELECT COUNT(*) FROM classes c
                WHERE c.trainer_id = s.id
                  AND c.starts_at >= date_trunc('week', NOW())
                  AND c.starts_at < date_trunc('week', NOW()) + INTERVAL '7 days'
              ) ELSE NULL END AS classes_this_week,
              CASE WHEN s.role = 'trainer' THEN (
                SELECT COUNT(DISTINCT b.member_id) FROM class_bookings b
                JOIN classes c ON c.id = b.class_id
                WHERE c.trainer_id = s.id AND b.status IN ('confirmed', 'attended')
              ) ELSE NULL END AS members_coached
       FROM staff s
       ORDER BY s.role ASC, s.name ASC`,
    )
    res.json({ staff: rows })
  } catch (err) {
    console.error('[settings/staff GET]', err)
    res.status(500).json({ error: 'Failed to load staff.' })
  }
})

// ─── POST /api/settings/staff ─────────────────────────────────────────────────

settingsRouter.post('/staff', validate(createStaffSchema), async (req, res) => {
  try {
    const { name, email, phone, role, password, pin } = req.body

    const [passwordHash, pinHash] = await Promise.all([
      bcrypt.hash(password, 12),
      pin ? bcrypt.hash(pin, 12) : Promise.resolve(null),
    ])

    const id = uuid()
    await tenantQuery(
      req.tenant.slug,
      `INSERT INTO staff (id, name, email, phone, password_hash, pin_hash, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW(), NOW())`,
      [id, name, email.toLowerCase(), phone ?? null, passwordHash, pinHash, role],
    )
    res.status(201).json({ id, ok: true })
  } catch (err) {
    console.error('[settings/staff POST]', err)
    res.status(500).json({ error: 'Failed to create staff member.' })
  }
})

// ─── PATCH /api/settings/staff/:id ───────────────────────────────────────────

settingsRouter.patch('/staff/:id', async (req, res) => {
  try {
    const { id } = req.params
    const allowed = ['name', 'phone', 'role', 'is_active', 'avatar_url']
    const fields = req.body as Record<string, unknown>

    const params: unknown[] = []
    const sets: string[] = ['updated_at = NOW()']
    for (const [k, v] of Object.entries(fields)) {
      if (!allowed.includes(k)) continue
      params.push(v ?? null)
      sets.push(`${k} = $${params.length}`)
    }
    if (params.length === 0) return res.status(400).json({ error: 'Nothing to update.' })

    params.push(id)
    await tenantQuery(
      req.tenant.slug,
      `UPDATE staff SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params,
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[settings/staff/:id PATCH]', err)
    res.status(500).json({ error: 'Failed to update staff member.' })
  }
})

// ─── PATCH /api/settings/staff/:id/pin ───────────────────────────────────────
// Set or clear the kiosk PIN for a staff member. Only owners/admins.

settingsRouter.patch('/staff/:id/pin', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const { id } = req.params
    const { pin } = req.body as { pin?: string }

    if (pin !== undefined && pin !== null && pin !== '') {
      if (!/^\d{4}$/.test(pin)) {
        return res.status(400).json({ error: 'PIN must be exactly 4 digits.' })
      }
      const pinHash = await bcrypt.hash(pin, 12)
      await tenantQuery(
        req.tenant.slug,
        `UPDATE staff SET pin_hash = $1, updated_at = NOW() WHERE id = $2`,
        [pinHash, id],
      )
    } else {
      // Clearing the PIN
      await tenantQuery(
        req.tenant.slug,
        `UPDATE staff SET pin_hash = NULL, updated_at = NOW() WHERE id = $1`,
        [id],
      )
    }
    res.json({ ok: true })
  } catch (err) {
    console.error('[settings/staff/:id/pin PATCH]', err)
    res.status(500).json({ error: 'Failed to update PIN.' })
  }
})

// ─── DELETE /api/settings/staff/:id ──────────────────────────────────────────

settingsRouter.delete('/staff/:id', requireRole('owner'), async (req, res) => {
  try {
    const { id } = req.params

    // Prevent owner from deleting themselves
    if (id === req.auth.sub) {
      return res.status(400).json({ error: 'Cannot delete your own account.' })
    }

    await tenantQuery(
      req.tenant.slug,
      `DELETE FROM staff WHERE id = $1`,
      [id],
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[settings/staff/:id DELETE]', err)
    res.status(500).json({ error: 'Failed to delete staff member.' })
  }
})

// ─── POST /api/settings/support/tickets ──────────────────────────────────────
// Gym owner submits a support ticket

settingsRouter.post('/support/tickets', async (req, res) => {
  try {
    const { subject, body, priority = 'medium' } = req.body
    if (!subject?.trim() || !body?.trim()) {
      return res.status(400).json({ error: 'Subject and body are required.' })
    }

    const ticketId = uuid()
    const msgId = uuid()

    await globalQuery(
      `INSERT INTO support_tickets (id, tenant_id, subject, status, priority, created_at, updated_at)
       VALUES ($1, $2, $3, 'open', $4, NOW(), NOW())`,
      [ticketId, req.tenant.id, subject.trim(), priority],
    )
    await globalQuery(
      `INSERT INTO support_messages (id, ticket_id, from_role, body, created_at)
       VALUES ($1, $2, 'gym', $3, NOW())`,
      [msgId, ticketId, body.trim()],
    )

    // Notify support team
    const supportEmail = process.env.SUPPORT_EMAIL ?? process.env.EMAIL_FROM ?? 'ndanwemarcel@gmail.com'
    await sendNewTicketEmail(
      { email: supportEmail, name: 'myfiti Support' },
      subject.trim(),
      body.trim(),
      req.tenant.name,
    ).catch(err => console.error('[support ticket email]', err))

    res.json({ ok: true, ticketId })
  } catch (err) {
    console.error('[settings/support/tickets POST]', err)
    res.status(500).json({ error: 'Failed to create support ticket.' })
  }
})

// ─── GET /api/settings/messages ───────────────────────────────────────────────
// List all members who have notifications (used as conversation list)

settingsRouter.get('/messages', async (req, res) => {
  try {
    const { rows } = await tenantQuery(req.tenant.slug, `
      SELECT
        m.id AS member_id, m.name AS member_name, m.email AS member_email,
        m.phone, m.status AS member_status,
        sub.status AS sub_status, sub.expires_at,
        plan.name AS plan_name,
        n.last_body AS last_message, n.last_at AS last_message_at,
        n.last_at AS last_channel,
        n_unread.unread_count AS unread
      FROM members m
      LEFT JOIN LATERAL (
        SELECT s.status, s.expires_at, s.plan_id
        FROM subscriptions s WHERE s.member_id = m.id ORDER BY s.created_at DESC LIMIT 1
      ) sub ON true
      LEFT JOIN membership_plans plan ON plan.id = sub.plan_id
      LEFT JOIN LATERAL (
        SELECT body AS last_body, created_at AS last_at
        FROM notifications WHERE member_id = m.id ORDER BY created_at DESC LIMIT 1
      ) n ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS unread_count
        FROM notifications WHERE member_id = m.id AND read_at IS NULL AND channel = 'in_app'
      ) n_unread ON true
      ORDER BY n.last_at DESC NULLS LAST, m.created_at DESC
      LIMIT 100
    `)
    res.json({ conversations: rows })
  } catch (err) {
    console.error('[settings/messages GET]', err)
    res.status(500).json({ error: 'Failed to load messages.' })
  }
})

// ─── GET /api/settings/messages/:memberId ─────────────────────────────────────

settingsRouter.get('/messages/:memberId', async (req, res) => {
  try {
    const { memberId } = req.params
    const [memberRes, notifRes] = await Promise.all([
      tenantQuery(req.tenant.slug, `
        SELECT m.id, m.name, m.email, m.phone, m.status,
          sub.status AS sub_status, sub.expires_at,
          plan.name AS plan_name, plan.price AS plan_price,
          m.joined_at,
          (SELECT COUNT(*) FROM check_ins WHERE member_id = m.id)::int AS total_checkins
        FROM members m
        LEFT JOIN LATERAL (
          SELECT s.status, s.expires_at, s.plan_id FROM subscriptions s WHERE s.member_id = m.id ORDER BY s.created_at DESC LIMIT 1
        ) sub ON true
        LEFT JOIN membership_plans plan ON plan.id = sub.plan_id
        WHERE m.id = $1 LIMIT 1`, [memberId]),
      tenantQuery(req.tenant.slug,
        `SELECT id, type, channel, title, body, sent_at, read_at, created_at
         FROM notifications WHERE member_id = $1 ORDER BY created_at ASC LIMIT 200`, [memberId]),
    ])
    // Mark in-app notifications as read
    await tenantQuery(req.tenant.slug,
      `UPDATE notifications SET read_at = NOW() WHERE member_id = $1 AND channel = 'in_app' AND read_at IS NULL`,
      [memberId],
    ).catch(() => {})
    res.json({ member: memberRes.rows[0] ?? null, messages: notifRes.rows })
  } catch (err) {
    console.error('[settings/messages/:id GET]', err)
    res.status(500).json({ error: 'Failed to load conversation.' })
  }
})

// ─── POST /api/settings/messages/:memberId ────────────────────────────────────
// Send a message to a member

settingsRouter.post('/messages/:memberId', async (req, res) => {
  try {
    const { memberId } = req.params
    const { body, channel = 'in_app', subject } = req.body as { body: string; channel?: string; subject?: string }
    if (!body?.trim()) return res.status(400).json({ error: 'Message body required.' })

    const { rows: memberRows } = await tenantQuery(
      req.tenant.slug, `SELECT id, name, email, push_token FROM members WHERE id = $1 LIMIT 1`, [memberId],
    )
    const member = memberRows[0] as { id: string; name: string; email: string; push_token: string | null } | undefined
    if (!member) return res.status(404).json({ error: 'Member not found.' })

    const id = uuid()
    const title = subject?.trim() || 'Message from your gym'

    await tenantQuery(
      req.tenant.slug,
      `INSERT INTO notifications (id, member_id, type, channel, title, body, sent_at, created_at)
       VALUES ($1, $2, 'in_app', $3, $4, $5, NOW(), NOW())`,
      [id, memberId, channel, title, body.trim()],
    )

    if (channel === 'email' && member.email) {
      await sendAnnouncementEmail(
        { email: member.email, name: member.name },
        title,
        body.trim(),
        req.tenant.name,
      ).catch(err => console.warn('[settings/messages POST] email error:', err))
    }

    if (channel === 'push' && member.push_token && Expo.isExpoPushToken(member.push_token)) {
      try {
        await expo.sendPushNotificationsAsync([{
          to: member.push_token,
          sound: 'default',
          title,
          body: body.trim(),
          data: { type: 'in_app' },
        }])
      } catch (err) {
        console.warn('[settings/messages POST] push error:', err)
      }
    }

    res.status(201).json({ id, ok: true })
  } catch (err) {
    console.error('[settings/messages/:id POST]', err)
    res.status(500).json({ error: 'Failed to send message.' })
  }
})

// ─── GET /api/settings/support/tickets ───────────────────────────────────────
// Gym owner views their own tickets

settingsRouter.get('/support/tickets', async (req, res) => {
  try {
    const { rows: tickets } = await globalQuery<{
      id: string; subject: string; status: string; priority: string
      created_at: string; updated_at: string
    }>(
      `SELECT id, subject, status, priority, created_at, updated_at
       FROM support_tickets WHERE tenant_id = $1 ORDER BY updated_at DESC`,
      [req.tenant.id],
    )

    if (tickets.length === 0) return res.json({ tickets: [] })

    const ticketIds = tickets.map(t => t.id)
    const placeholders = ticketIds.map((_, i) => `$${i + 1}`).join(', ')
    const { rows: messages } = await globalQuery<{
      id: string; ticket_id: string; from_role: string; body: string; created_at: string
    }>(
      `SELECT id, ticket_id, from_role, body, created_at FROM support_messages
       WHERE ticket_id IN (${placeholders}) ORDER BY created_at ASC`,
      ticketIds,
    )

    const msgByTicket = new Map<string, typeof messages>()
    for (const m of messages) {
      if (!msgByTicket.has(m.ticket_id)) msgByTicket.set(m.ticket_id, [])
      msgByTicket.get(m.ticket_id)!.push(m)
    }

    res.json({
      tickets: tickets.map(t => ({
        ...t,
        messages: (msgByTicket.get(t.id) ?? []).map(m => ({
          id: m.id, from: m.from_role, text: m.body, time: m.created_at,
        })),
      })),
    })
  } catch (err) {
    console.error('[settings/support/tickets GET]', err)
    res.status(500).json({ error: 'Failed to load tickets.' })
  }
})
