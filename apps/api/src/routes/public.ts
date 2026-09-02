import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { globalQuery } from '../db/client.js'
import { rateLimitApi } from '../middleware/rate-limit.js'
import { sendMemberWelcomeEmail } from '../lib/email.js'

export const publicRouter = Router()

// ─── In-memory OTP store (5-minute TTL) ─────────────────────────────────────
const otpStore = new Map<string, { code: string; expiresAt: number }>()
function genOtp() { return String(Math.floor(100000 + Math.random() * 900000)) }

// Slug format: lowercase alphanumeric + hyphens, 2-63 chars
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/

// UUID format
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const PLAN_LABEL: Record<string, string> = {
  starter: 'Starter', growth: 'Growth', growth_plus: 'Growth+', enterprise: 'Enterprise',
}

const PLAN_PRICE_XAF: Record<string, number> = {
  starter: 0, growth: 9900, growth_plus: 19900, enterprise: 49900,
}

// ─── GET /api/public/gym/:slug ──────────────────────────────────────────────
// Public gym lookup — used by the mobile app login screen to resolve branding

publicRouter.get('/gym/:slug', async (req, res) => {
  try {
    const { slug } = req.params
    if (!SLUG_RE.test(slug)) {
      return res.status(400).json({ error: 'Invalid gym identifier.' })
    }

    const { rows } = await globalQuery<{
      id: string; name: string; slug: string
      logo_url: string | null; primary_color: string
      currency: string
    }>(
      `SELECT id, name, slug, logo_url, primary_color, currency
       FROM tenants
       WHERE slug = $1 AND status != 'suspended'
       LIMIT 1`,
      [slug],
    )

    if (!rows[0]) {
      return res.status(404).json({ error: 'Gym not found.' })
    }

    return res.json({ gym: rows[0] })
  } catch (err) {
    console.error('[public/gym/:slug]', err)
    return res.status(500).json({ error: 'Failed to lookup gym.' })
  }
})

// ─── GET /api/public/gym/:slug/plans ────────────────────────────────────────
// Public plans listing — for member signup / pricing page

publicRouter.get('/gym/:slug/plans', async (req, res) => {
  try {
    const { slug } = req.params
    if (!SLUG_RE.test(slug)) {
      return res.status(400).json({ error: 'Invalid gym identifier.' })
    }
    const { tenantQuery } = await import('../db/client.js')

    const { rows } = await tenantQuery(
      slug,
      `SELECT id, name, description, price, currency, duration_days, cycle, features
       FROM membership_plans
       WHERE is_active = TRUE
       ORDER BY price ASC`,
    )

    return res.json({ plans: rows })
  } catch (err) {
    console.error('[public/gym/:slug/plans]', err)
    return res.status(500).json({ error: 'Failed to load plans.' })
  }
})

// ─── GET /api/public/gym/:slug/member ───────────────────────────────────────
// Look up a member by email or id — used by the renewal page to pre-fill info.

publicRouter.get('/gym/:slug/member', async (req, res) => {
  try {
    const { slug } = req.params
    if (!SLUG_RE.test(slug)) return res.status(400).json({ error: 'Invalid gym identifier.' })

    const { email, mid } = req.query as { email?: string; mid?: string }
    if (!email && !mid) return res.status(400).json({ error: 'email or mid required.' })

    const { tenantQuery } = await import('../db/client.js')

    let rows: { id: string; name: string; email: string; status: string }[]

    if (mid && UUID_RE.test(mid)) {
      const result = await tenantQuery<{ id: string; name: string; email: string; status: string }>(
        slug,
        `SELECT id, name, email, status FROM members WHERE id = $1 LIMIT 1`,
        [mid],
      )
      rows = result.rows
    } else if (email) {
      const result = await tenantQuery<{ id: string; name: string; email: string; status: string }>(
        slug,
        `SELECT id, name, email, status FROM members WHERE email = $1 LIMIT 1`,
        [email.toLowerCase().trim()],
      )
      rows = result.rows
    } else {
      return res.status(400).json({ error: 'Invalid parameters.' })
    }

    if (!rows[0]) return res.status(404).json({ error: 'Member not found at this gym.' })
    const member = rows[0]

    // Get active/latest subscription
    const { rows: subRows } = await tenantQuery<{
      id: string; status: string; expires_at: string; plan_name: string; wallet_balance: string | null
    }>(
      slug,
      `SELECT s.id, s.status, s.expires_at, mp.name AS plan_name,
              wa.balance::text AS wallet_balance
       FROM subscriptions s
       LEFT JOIN membership_plans mp ON mp.id = s.plan_id
       LEFT JOIN wallet_accounts wa ON wa.member_id = s.member_id
       WHERE s.member_id = $1
       ORDER BY s.created_at DESC LIMIT 1`,
      [member.id],
    )
    const sub = subRows[0] ?? null

    return res.json({
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
        status: member.status,
      },
      subscription: sub ? {
        id: sub.id,
        status: sub.status,
        expires_at: sub.expires_at,
        plan_name: sub.plan_name,
      } : null,
      wallet_balance: sub?.wallet_balance ? parseFloat(sub.wallet_balance) : 0,
    })
  } catch (err) {
    console.error('[public/gym/:slug/member]', err)
    return res.status(500).json({ error: 'Failed to look up member.' })
  }
})

// ─── POST /api/public/gym/:slug/renew ────────────────────────────────────────
// Member self-renewal — wallet, mobile money (Tranzak), or cash.

publicRouter.post('/gym/:slug/renew', rateLimitApi, async (req, res) => {
  try {
    const { slug } = req.params
    if (!SLUG_RE.test(slug)) return res.status(400).json({ error: 'Invalid gym identifier.' })

    const { member_id, plan_id, payment_method } = req.body as {
      member_id?: string; plan_id?: string; payment_method?: 'wallet' | 'mobile_money' | 'cash'
    }

    if (!member_id || !UUID_RE.test(member_id)) return res.status(400).json({ error: 'member_id required.' })
    if (!plan_id || !UUID_RE.test(plan_id)) return res.status(400).json({ error: 'plan_id required.' })
    if (!payment_method || !['wallet', 'mobile_money', 'cash'].includes(payment_method)) {
      return res.status(400).json({ error: 'payment_method must be wallet, mobile_money, or cash.' })
    }

    const { rows: gymRows } = await globalQuery<{ id: string; name: string; status: string; currency: string }>(
      `SELECT id, name, status, currency FROM tenants WHERE slug = $1 LIMIT 1`,
      [slug],
    )
    const gym = gymRows[0]
    if (!gym) return res.status(404).json({ error: 'Gym not found.' })

    const { tenantQuery } = await import('../db/client.js')

    // Verify member belongs to this gym
    const { rows: memberRows } = await tenantQuery<{ id: string; name: string; email: string; status: string }>(
      slug,
      `SELECT id, name, email, status FROM members WHERE id = $1 LIMIT 1`,
      [member_id],
    )
    const member = memberRows[0]
    if (!member) return res.status(404).json({ error: 'Member not found.' })

    // Resolve plan
    const { rows: planRows } = await tenantQuery<{ id: string; name: string; price: number; duration_days: number }>(
      slug,
      `SELECT id, name, price, duration_days FROM membership_plans WHERE id = $1 AND is_active = TRUE LIMIT 1`,
      [plan_id],
    )
    const plan = planRows[0]
    if (!plan) return res.status(404).json({ error: 'Plan not found.' })

    const newExpiry = new Date()
    newExpiry.setDate(newExpiry.getDate() + plan.duration_days)

    // ── Wallet payment ────────────────────────────────────────────────────────
    if (payment_method === 'wallet') {
      const { rows: debitRows } = await tenantQuery<{ balance: string }>(
        slug,
        `UPDATE wallet_accounts SET balance = balance - $1
         WHERE member_id = $2 AND balance >= $1
         RETURNING balance`,
        [plan.price, member_id],
      )
      if (!debitRows[0]) {
        return res.status(402).json({ error: 'Insufficient wallet balance.' })
      }

      const subId = uuid()
      await Promise.all([
        tenantQuery(slug,
          `INSERT INTO subscriptions (id, member_id, plan_id, status, started_at, expires_at, created_at, updated_at)
           VALUES ($1, $2, $3, 'active', NOW(), $4, NOW(), NOW())
           ON CONFLICT DO NOTHING`,
          [subId, member_id, plan_id, newExpiry.toISOString()],
        ),
        tenantQuery(slug,
          `UPDATE members SET status = 'active', updated_at = NOW() WHERE id = $1`,
          [member_id],
        ),
        tenantQuery(slug,
          `INSERT INTO wallet_transactions (id, member_id, type, amount, description, status)
           VALUES ($1, $2, 'debit', $3, $4, 'completed')`,
          [uuid(), member_id, plan.price, `Membership renewal — ${plan.name}`],
        ),
      ])

      return res.json({ ok: true, method: 'wallet', expires_at: newExpiry.toISOString() })
    }

    // ── Mobile money (Tranzak) ────────────────────────────────────────────────
    if (payment_method === 'mobile_money') {
      const appId  = process.env.TRANZAK_APP_ID
      const appKey = process.env.TRANZAK_APP_KEY
      if (!appId || !appKey) {
        return res.status(503).json({ error: 'Payment provider not configured.' })
      }
      const BASE_URL = process.env.TRANZAK_ENV === 'live' ? 'https://dsapi.tranzak.me' : 'https://sandbox.dsapi.tranzak.me'
      const APP_URL  = process.env.APP_URL ?? 'https://app.myfiti.fit'

      const authRes = await fetch(`${BASE_URL}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, appKey }),
      })
      if (!authRes.ok) throw new Error('Tranzak auth failed')
      const authBody = await authRes.json() as { data?: { token: string }; token?: string }
      const token = authBody.data?.token ?? authBody.token ?? ''
      if (!token) throw new Error('Tranzak auth: no token in response')

      const subId = uuid()
      const merchantTransactionId = `ren-${member_id}-${Date.now()}`
      const API_URL = process.env.API_URL ?? 'https://api.myfiti.fit'
      const callbackUrl = `${API_URL}/api/webhooks/tranzak?ctx=public-renew&tenant=${slug}&id=${subId}`

      const paymentRes = await fetch(`${BASE_URL}/xp021/v1/request/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          amount: plan.price,
          currencyCode: gym.currency ?? 'XAF',
          description: `${gym.name} membership renewal: ${plan.name}`,
          merchantTransactionId,
          returnUrl: `${APP_URL}/member/renew?gym=${slug}&mid=${member_id}&payment=verify`,
          callbackUrl,
          customData: { member_id, plan_id, gym_slug: slug },
        }),
      })
      if (!paymentRes.ok) throw new Error(`Tranzak error: ${await paymentRes.text()}`)

      const paymentData = await paymentRes.json() as { data?: { paymentUrl: string; requestId: string } }
      const paymentUrl      = paymentData?.data?.paymentUrl ?? ''
      const tranzakRequestId = paymentData?.data?.requestId ?? ''

      if (!paymentUrl) {
        return res.status(502).json({ error: 'Payment provider did not return a redirect URL. Please try again.' })
      }

      // Create pending subscription
      await tenantQuery(slug,
        `INSERT INTO subscriptions (id, member_id, plan_id, status, started_at, expires_at, created_at, updated_at)
         VALUES ($1, $2, $3, 'pending', NOW(), $4, NOW(), NOW())`,
        [subId, member_id, plan_id, newExpiry.toISOString()],
      )

      return res.json({ ok: true, method: 'mobile_money', payment_url: paymentUrl, payment_id: tranzakRequestId })
    }

    // ── Cash ──────────────────────────────────────────────────────────────────
    if (payment_method === 'cash') {
      const ref = `REN-${member_id.slice(0, 8).toUpperCase()}`
      await tenantQuery(slug,
        `INSERT INTO subscriptions (id, member_id, plan_id, status, started_at, expires_at, created_at, updated_at)
         VALUES ($1, $2, $3, 'pending', NOW(), $4, NOW(), NOW())`,
        [uuid(), member_id, plan_id, newExpiry.toISOString()],
      )
      return res.json({ ok: true, method: 'cash', reference: ref, plan_name: plan.name, amount: plan.price, currency: gym.currency ?? 'XAF' })
    }
  } catch (err) {
    console.error('[public/gym/:slug/renew]', err)
    return res.status(500).json({ error: 'Renewal failed. Please try again.' })
  }
})

// ─── POST /api/public/gym/:slug/send-otp ─────────────────────────────────────
// Send a 6-digit OTP to the member's email before wallet debit.

publicRouter.post('/gym/:slug/send-otp', rateLimitApi, async (req, res) => {
  try {
    const { slug } = req.params
    if (!SLUG_RE.test(slug)) return res.status(400).json({ error: 'Invalid gym identifier.' })

    const { member_id } = req.body as { member_id?: string }
    if (!member_id || !UUID_RE.test(member_id)) return res.status(400).json({ error: 'member_id required.' })

    const { tenantQuery } = await import('../db/client.js')
    const { rows } = await tenantQuery<{ id: string; name: string; email: string }>(
      slug,
      `SELECT id, name, email FROM members WHERE id = $1 LIMIT 1`,
      [member_id],
    )
    if (!rows[0]) return res.status(404).json({ error: 'Member not found.' })

    const otp = genOtp()
    otpStore.set(`${slug}:${member_id}`, { code: otp, expiresAt: Date.now() + 5 * 60 * 1000 })

    const { sendOtpEmail } = await import('../lib/email.js')
    await sendOtpEmail({ email: rows[0].email, name: rows[0].name }, otp)

    // Return a masked email so the UI can confirm where the code was sent
    const masked = rows[0].email.replace(/^(.{2})(.*)(@.*)$/, (_, a, _b, c) => `${a}***${c}`)
    return res.json({ ok: true, sent_to: masked })
  } catch (err) {
    console.error('[public/send-otp]', err)
    return res.status(500).json({ error: 'Failed to send OTP.' })
  }
})

// ─── POST /api/public/gym/:slug/verify-otp ───────────────────────────────────
// Verify the OTP before executing a wallet payment.

publicRouter.post('/gym/:slug/verify-otp', rateLimitApi, async (req, res) => {
  const { slug } = req.params
  const { member_id, otp } = req.body as { member_id?: string; otp?: string }

  if (!member_id || !UUID_RE.test(member_id)) return res.status(400).json({ error: 'member_id required.' })
  if (!otp) return res.status(400).json({ error: 'otp required.' })

  const key   = `${slug}:${member_id}`
  const entry = otpStore.get(key)

  if (!entry || entry.expiresAt < Date.now()) {
    otpStore.delete(key)
    return res.status(401).json({ error: 'Code expired or not found. Request a new one.' })
  }
  if (entry.code !== otp.trim()) {
    return res.status(401).json({ error: 'Incorrect code.' })
  }

  otpStore.delete(key)
  return res.json({ ok: true })
})

// ─── GET /api/public/gym/:slug/payment-status ────────────────────────────────
// Poll Tranzak for payment status. Activates pending subscription on success.
// Used by the web renewal page after redirect back from Tranzak.

publicRouter.get('/gym/:slug/payment-status', async (req, res) => {
  try {
    const { slug } = req.params
    const { pid, mid } = req.query as { pid?: string; mid?: string }

    if (!SLUG_RE.test(slug)) return res.status(400).json({ error: 'Invalid gym identifier.' })
    if (!pid) return res.status(400).json({ error: 'pid required.' })
    if (!mid || !UUID_RE.test(mid)) return res.status(400).json({ error: 'mid required.' })

    const appId  = process.env.TRANZAK_APP_ID
    const appKey = process.env.TRANZAK_APP_KEY
    if (!appId || !appKey) return res.status(503).json({ error: 'Payment provider not configured.' })

    const BASE_URL = process.env.TRANZAK_ENV === 'live' ? 'https://dsapi.tranzak.me' : 'https://sandbox.dsapi.tranzak.me'

    const authRes = await fetch(`${BASE_URL}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId, appKey }),
    })
    if (!authRes.ok) return res.status(502).json({ error: 'Could not reach payment provider.' })
    const authBody = await authRes.json() as { data?: { token: string }; token?: string }
    const token = authBody.data?.token ?? authBody.token ?? ''
    if (!token) return res.status(502).json({ error: 'Payment provider auth failed.' })

    const detailRes = await fetch(`${BASE_URL}/xp021/v1/request/details?requestId=${encodeURIComponent(pid)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!detailRes.ok) return res.status(502).json({ error: 'Could not get payment status.' })

    const detail = await detailRes.json() as {
      data?: { status: string; amount: number; currencyCode: string; mchTransactionRef: string }
    }
    const tzStatus = detail?.data?.status ?? 'PENDING'
    const mchRef   = detail?.data?.mchTransactionRef ?? ''

    // Security: verify this payment was initiated for this member
    if (!mchRef.startsWith(`ren-${mid}`)) {
      return res.status(403).json({ error: 'Payment does not belong to this member.' })
    }

    if (tzStatus !== 'SUCCESSFUL') {
      const failed = ['FAILED', 'CANCELLED', 'CANCELLED_BY_PAYER'].includes(tzStatus)
      return res.json({ status: failed ? 'failed' : 'pending' })
    }

    // Activate the member's most recent pending subscription (idempotent)
    const { tenantQuery } = await import('../db/client.js')
    const { rows } = await tenantQuery<{ expires_at: string }>(
      slug,
      `UPDATE subscriptions SET status = 'active', updated_at = NOW()
       WHERE id = (
         SELECT id FROM subscriptions
         WHERE member_id = $1 AND status = 'pending'
         ORDER BY created_at DESC LIMIT 1
       )
       RETURNING expires_at`,
      [mid],
    )

    await tenantQuery(slug,
      `UPDATE members SET status = 'active', updated_at = NOW() WHERE id = $1`,
      [mid],
    )

    return res.json({ status: 'successful', expires_at: rows[0]?.expires_at ?? null })
  } catch (err) {
    console.error('[public/payment-status]', err)
    return res.status(500).json({ error: 'Failed to check payment status.' })
  }
})

// ─── GET /api/public/invoice/:invoiceId ──────────────────────────────────────
// Public invoice lookup — used by the /billing/pay/[invoiceId] pay page.
// The UUID acts as the access token (hard to guess, fine for billing use).

publicRouter.get('/invoice/:invoiceId', async (req, res) => {
  try {
    const { invoiceId } = req.params
    if (!UUID_RE.test(invoiceId)) {
      return res.status(400).json({ error: 'Invalid invoice identifier.' })
    }

    const { rows } = await globalQuery<{
      id: string; invoice_number: string; amount_xaf: number; status: string
      plan: string; period_start: string; period_end: string; due_date: string
      paid_at: string | null; gym_name: string; owner_name: string
    }>(
      `SELECT pi.id, pi.invoice_number, pi.amount_xaf, pi.status, pi.plan,
              pi.period_start, pi.period_end, pi.due_date, pi.paid_at,
              t.name AS gym_name, t.owner_name
       FROM platform_invoices pi
       JOIN tenants t ON t.id = pi.tenant_id
       WHERE pi.id = $1 LIMIT 1`,
      [invoiceId],
    )

    if (!rows[0]) return res.status(404).json({ error: 'Invoice not found.' })

    const inv = rows[0]
    return res.json({
      invoice: {
        id:             inv.id,
        invoice_number: inv.invoice_number,
        amount_xaf:     inv.amount_xaf,
        status:         inv.status,
        plan:           PLAN_LABEL[inv.plan] ?? inv.plan,
        period_start:   inv.period_start,
        period_end:     inv.period_end,
        due_date:       inv.due_date,
        paid_at:        inv.paid_at,
        gym_name:       inv.gym_name,
        owner_name:     inv.owner_name,
      },
    })
  } catch (err) {
    console.error('[public/invoice/:invoiceId]', err)
    return res.status(500).json({ error: 'Failed to load invoice.' })
  }
})

// ─── POST /api/public/invoice/:invoiceId/pay ─────────────────────────────────
// Initiate a Tranzak payment for a specific platform invoice.
// No auth required — the invoice UUID is the access token.

publicRouter.post('/invoice/:invoiceId/pay', rateLimitApi, async (req, res) => {
  try {
    const { invoiceId } = req.params
    if (!UUID_RE.test(invoiceId)) {
      return res.status(400).json({ error: 'Invalid invoice identifier.' })
    }

    const { rows } = await globalQuery<{
      id: string; invoice_number: string; amount_xaf: number; status: string
      tenant_id: string; currency: string
    }>(
      `SELECT pi.id, pi.invoice_number, pi.amount_xaf, pi.status,
              pi.tenant_id, t.currency
       FROM platform_invoices pi
       JOIN tenants t ON t.id = pi.tenant_id
       WHERE pi.id = $1 LIMIT 1`,
      [invoiceId],
    )

    const inv = rows[0]
    if (!inv) return res.status(404).json({ error: 'Invoice not found.' })
    if (inv.status === 'paid' || inv.status === 'cancelled') {
      return res.status(400).json({ error: `Invoice is already ${inv.status}.` })
    }

    const appId  = process.env.TRANZAK_APP_ID
    const appKey = process.env.TRANZAK_APP_KEY
    if (!appId || !appKey) {
      return res.status(503).json({ error: 'Payment provider not configured. Please contact support.' })
    }
    const BASE_URL = process.env.TRANZAK_ENV === 'live' ? 'https://dsapi.tranzak.me' : 'https://sandbox.dsapi.tranzak.me'

    // Auth
    const authRes = await fetch(`${BASE_URL}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId, appKey }),
    })
    if (!authRes.ok) throw new Error('Tranzak auth failed')
    const authBody = await authRes.json() as { data?: { token: string }; token?: string }
    const token = authBody.data?.token ?? authBody.token ?? ''
    if (!token) throw new Error('Tranzak auth: no token in response')

    const APP_URL = process.env.APP_URL ?? 'https://app.myfiti.fit'
    const merchantTransactionId = `ten-${inv.tenant_id}`

    // Create payment
    const paymentRes = await fetch(`${BASE_URL}/xp021/v1/request/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        amount:               inv.amount_xaf,
        currencyCode:         inv.currency ?? 'XAF',
        description:          `myfiti invoice ${inv.invoice_number}`,
        merchantTransactionId,
        returnUrl:            `${APP_URL}/billing/pay/${invoiceId}?payment=success`,
        customData:           { tenant_id: inv.tenant_id, invoice_id: inv.id },
      }),
    })
    if (!paymentRes.ok) {
      const errText = await paymentRes.text()
      throw new Error(`Tranzak create error: ${errText}`)
    }

    const paymentData = await paymentRes.json() as { data?: { paymentUrl: string } }
    const paymentUrl  = paymentData?.data?.paymentUrl ?? ''

    return res.json({ ok: true, payment_url: paymentUrl })
  } catch (err) {
    console.error('[public/invoice/:invoiceId/pay]', err)
    return res.status(500).json({ error: 'Failed to initiate payment.' })
  }
})

// ─── POST /api/public/gym/:slug/register ─────────────────────────────────────
// Public member self-registration — no auth required.
// Creates the member record + optional pending subscription, sends welcome email.

publicRouter.post('/gym/:slug/register', rateLimitApi, async (req, res) => {
  try {
    const { slug } = req.params
    if (!SLUG_RE.test(slug)) {
      return res.status(400).json({ error: 'Invalid gym identifier.' })
    }

    const { name, email, phone, plan_id, payment_method, payment_ref } = req.body as {
      name?: string; email?: string; phone?: string; plan_id?: string
      payment_method?: string; payment_ref?: string
    }

    if (!name?.trim() || !email?.trim()) {
      return res.status(400).json({ error: 'Name and email are required.' })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'Invalid email address.' })
    }

    // Resolve tenant
    const { rows: gymRows } = await globalQuery<{ id: string; name: string; status: string }>(
      `SELECT id, name, status FROM tenants WHERE slug = $1 LIMIT 1`,
      [slug],
    )
    const gym = gymRows[0]
    if (!gym) return res.status(404).json({ error: 'Gym not found.' })
    if (gym.status === 'suspended' || gym.status === 'cancelled') {
      return res.status(403).json({ error: 'This gym is not accepting registrations.' })
    }

    const { tenantQuery } = await import('../db/client.js')

    // Check for duplicate email
    const { rows: existing } = await tenantQuery<{ id: string }>(
      slug,
      `SELECT id FROM members WHERE email = $1 LIMIT 1`,
      [email.toLowerCase().trim()],
    )
    if (existing.length > 0) {
      return res.status(409).json({ error: 'A member with this email already exists at this gym.' })
    }

    const id = uuid()
    const qrCode = `myfiti-${id.slice(0, 8).toUpperCase()}`

    // If plan selected + payment method provided, member created as inactive (pending payment)
    const memberStatus = plan_id && payment_method ? 'inactive' : 'active'
    const paymentStatus = plan_id && payment_method ? 'pending_payment' : (payment_method ? 'pending_payment' : null)
    const paymentRef = uuid()

    await tenantQuery(
      slug,
      `INSERT INTO members (id, name, email, phone, status, qr_code, payment_status, payment_method, payment_ref, joined_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), NOW())`,
      [id, name.trim(), email.toLowerCase().trim(), phone?.trim() ?? null, memberStatus, qrCode, paymentStatus, payment_method || null, paymentStatus ? paymentRef : null],
    )

    // Create pending subscription if plan selected
    let planName: string | null = null
    let expiresAt: string | null = null
    if (plan_id && UUID_RE.test(plan_id)) {
      const { rows: planRows } = await tenantQuery<{ id: string; name: string; duration_days: number }>(
        slug,
        `SELECT id, name, duration_days FROM membership_plans WHERE id = $1 AND is_active = TRUE LIMIT 1`,
        [plan_id],
      )
      const plan = planRows[0]
      if (plan) {
        const subId = uuid()
        const starts = new Date()
        const expires = new Date(starts.getTime() + plan.duration_days * 86400000)
        expiresAt = expires.toISOString()
        planName = plan.name
        await tenantQuery(
          slug,
          `INSERT INTO subscriptions (id, member_id, plan_id, status, started_at, expires_at, created_at, updated_at)
           VALUES ($1, $2, $3, 'pending', NOW(), $4, NOW(), NOW())`,
          [subId, id, plan.id, expiresAt],
        )
      }
    }

    // Welcome email — only if member is active (no payment required)
    if (memberStatus === 'active') {
      sendMemberWelcomeEmail(
        { email: email.toLowerCase().trim(), name: name.trim() },
        gym.name,
        qrCode,
        planName,
        expiresAt,
        undefined,
        id,
      ).catch(err => console.warn('[public/register] welcome email failed:', err))
    }

    return res.status(201).json({
      ok: true,
      memberId: id,
      qrCode,
      payment_ref: paymentStatus ? paymentRef : undefined,
    })
  } catch (err) {
    console.error('[public/gym/:slug/register]', err)
    return res.status(500).json({ error: 'Registration failed. Please try again.' })
  }
})

// ─── POST /api/public/gym/:slug/register-with-tranzak ──────────────────
// Public member registration with Tranzak USSD payment — no auth required.
// Creates member as inactive, sends USSD, polls until payment confirmed.

publicRouter.post('/gym/:slug/register-with-tranzak', rateLimitApi, async (req, res) => {
  try {
    const { slug } = req.params
    if (!SLUG_RE.test(slug)) {
      return res.status(400).json({ error: 'Invalid gym identifier.' })
    }

    const { name, email, phone, plan_id, phone_for_payment } = req.body as {
      name?: string; email?: string; phone?: string; plan_id?: string
      phone_for_payment?: string
    }

    if (!name?.trim() || !email?.trim()) {
      return res.status(400).json({ error: 'Name and email are required.' })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'Invalid email address.' })
    }
    if (!phone_for_payment?.trim()) {
      return res.status(400).json({ error: 'Phone number for payment is required.' })
    }

    // Resolve tenant and plan
    const { rows: gymRows } = await globalQuery<{ id: string; name: string; status: string; currency: string }>(
      `SELECT id, name, status, currency FROM tenants WHERE slug = $1 LIMIT 1`,
      [slug],
    )
    const gym = gymRows[0]
    if (!gym) return res.status(404).json({ error: 'Gym not found.' })
    if (gym.status === 'suspended' || gym.status === 'cancelled') {
      return res.status(403).json({ error: 'This gym is not accepting registrations.' })
    }

    const { tenantQuery } = await import('../db/client.js')

    // Resolve plan
    if (!plan_id || !UUID_RE.test(plan_id)) {
      return res.status(400).json({ error: 'Valid plan required for payment.' })
    }

    const { rows: planRows } = await tenantQuery<{
      id: string; name: string; price: number; duration_days: number
    }>(
      slug,
      `SELECT id, name, price, duration_days FROM membership_plans WHERE id = $1 AND is_active = TRUE LIMIT 1`,
      [plan_id],
    )
    const plan = planRows[0]
    if (!plan) return res.status(404).json({ error: 'Plan not found.' })

    // Check for duplicate email
    const { rows: existing } = await tenantQuery<{ id: string }>(
      slug,
      `SELECT id FROM members WHERE email = $1 LIMIT 1`,
      [email.toLowerCase().trim()],
    )
    if (existing.length > 0) {
      return res.status(409).json({ error: 'A member with this email already exists at this gym.' })
    }

    // Create member (inactive, pending payment)
    const memberId = uuid()
    const qrCode = `myfiti-${memberId.slice(0, 8).toUpperCase()}`
    const paymentRef = uuid()

    await tenantQuery(
      slug,
      `INSERT INTO members (id, name, email, phone, status, qr_code, payment_status, payment_method, payment_ref, joined_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'inactive', $5, 'pending_payment', 'momo', $6, NOW(), NOW(), NOW())`,
      [memberId, name.trim(), email.toLowerCase().trim(), phone?.trim() ?? null, qrCode, paymentRef],
    )

    // Create pending subscription
    const subId = uuid()
    const starts = new Date()
    const expires = new Date(starts.getTime() + plan.duration_days * 86400000)
    await tenantQuery(
      slug,
      `INSERT INTO subscriptions (id, member_id, plan_id, status, started_at, expires_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'pending', NOW(), $4, NOW(), NOW())`,
      [subId, memberId, plan.id, expires.toISOString()],
    )

    // Send Tranzak USSD
    const appId  = process.env.TRANZAK_APP_ID
    const appKey = process.env.TRANZAK_APP_KEY
    if (!appId || !appKey) {
      return res.status(503).json({ error: 'Payment provider not configured. Please contact support.' })
    }
    const BASE_URL = process.env.TRANZAK_ENV === 'live' ? 'https://dsapi.tranzak.me' : 'https://sandbox.dsapi.tranzak.me'

    // Auth
    const authRes = await fetch(`${BASE_URL}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId, appKey }),
    })
    if (!authRes.ok) throw new Error('Tranzak auth failed')
    const authBody = await authRes.json() as { data?: { token: string }; token?: string }
    const token = authBody.data?.token ?? authBody.token ?? ''
    if (!token) throw new Error('Tranzak auth: no token in response')

    const APP_URL = process.env.APP_URL ?? 'https://app.myfiti.fit'
    const merchantTransactionId = `mem-${memberId}`

    // Create payment
    const paymentRes = await fetch(`${BASE_URL}/xp021/v1/request/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        amount:               plan.price,
        currencyCode:         gym.currency ?? 'XAF',
        description:          `${gym.name} membership: ${plan.name}`,
        merchantTransactionId,
        returnUrl:            `${APP_URL}/join/${slug}?payment=success`,
        customData:           { member_id: memberId, plan_id: plan.id },
      }),
    })
    if (!paymentRes.ok) {
      const errText = await paymentRes.text()
      throw new Error(`Tranzak create error: ${errText}`)
    }

    const paymentData = await paymentRes.json() as { data?: { paymentUrl: string; requestId: string } }
    const paymentId  = paymentData?.data?.requestId ?? uuid()

    return res.status(201).json({
      ok: true,
      member_id: memberId,
      qr_code: qrCode,
      payment_id: paymentId,
    })
  } catch (err) {
    console.error('[public/gym/:slug/register-with-tranzak]', err)
    return res.status(500).json({ error: 'Failed to process payment registration.' })
  }
})
