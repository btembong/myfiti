import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import jwt from 'jsonwebtoken'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { tenantQuery, globalQuery } from '../db/client.js'
import { paymentQueue } from '../jobs/index.js'
import { chargeMobileWallet, tranzak } from '../lib/tranzak.js'

export const dayPassesRouter = Router()

// Day pass pricing in XAF
const DAY_PASS_PRICES: Record<string, number> = {
  standard: 2000,
  peak: 2500,
  off_peak: 1500,
  student: 1000,
  bundle_10: 18000,
}

// ─── GET /api/day-passes/pricing ─────────────────────────────────────────────
// Return pricing table (public, no auth required)

dayPassesRouter.get('/pricing', (_req, res) => {
  res.json({ pricing: DAY_PASS_PRICES })
})

// ─── GET /api/day-passes ──────────────────────────────────────────────────────
// Admin list — returns paginated day passes with optional filters.

dayPassesRouter.get('/', requireAuth, requireRole('owner', 'admin', 'receptionist'), async (req, res) => {
  try {
    const { status, pass_type, from, to, search, page = '1', limit = '50' } = req.query as Record<string, string>
    const offset = (parseInt(page) - 1) * parseInt(limit)

    const params: unknown[] = []
    const conditions: string[] = []
    if (status)    { params.push(status);    conditions.push(`status = $${params.length}`) }
    if (pass_type) { params.push(pass_type); conditions.push(`pass_type = $${params.length}`) }
    if (from)      { params.push(from);      conditions.push(`created_at >= $${params.length}`) }
    if (to)        { params.push(to);        conditions.push(`created_at <= $${params.length}`) }
    if (search)    { params.push(`%${search}%`); conditions.push(`(guest_name ILIKE $${params.length} OR guest_phone ILIKE $${params.length})`) }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const countParams = [...params]
    params.push(parseInt(limit))
    const limitIdx = params.length
    params.push(offset)
    const offsetIdx = params.length

    const [{ rows }, { rows: countRows }, { rows: summaryRows }] = await Promise.all([
      tenantQuery(
        req.tenant.slug,
        `SELECT id, guest_name, guest_phone, pass_type, amount, currency, payment_method,
                status, valid_date, checked_in_at, tranzak_ref, notes, created_at
         FROM day_passes ${where}
         ORDER BY created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params,
      ),
      tenantQuery(req.tenant.slug, `SELECT COUNT(*) as count FROM day_passes ${where}`, countParams),
      tenantQuery(
        req.tenant.slug,
        `SELECT
           COALESCE(SUM(amount) FILTER (WHERE status IN ('active','used') AND created_at::date = CURRENT_DATE), 0) as today_revenue,
           COALESCE(SUM(amount) FILTER (WHERE status IN ('active','used') AND created_at >= date_trunc('month',NOW())), 0) as mtd_revenue,
           COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE) as today_count,
           COUNT(*) FILTER (WHERE status = 'used') as used_count,
           COUNT(*) FILTER (WHERE status = 'active') as active_count
         FROM day_passes`,
      ),
    ])

    res.json({
      day_passes: rows,
      total:   parseInt((countRows[0] as { count: string })?.count ?? '0'),
      page:    parseInt(page),
      limit:   parseInt(limit),
      summary: summaryRows[0],
    })
  } catch (err) {
    console.error('[day-passes GET]', err)
    res.status(500).json({ error: 'Failed to load day passes.' })
  }
})

// ─── POST /api/day-passes/verify ──────────────────────────────────────────────
// Verify a day pass QR at the kiosk gate (no auth required)

dayPassesRouter.post('/verify', async (req, res) => {
  try {
    const { token: qrToken } = req.body
    if (!qrToken) return res.status(400).json({ error: 'token is required.' })

    let payload: { sub: string; type: string; pass_type: string; valid_date: string; guest: string }
    try {
      payload = jwt.verify(qrToken, process.env.JWT_SECRET!) as typeof payload
    } catch {
      return res.json({ ok: false, reason: 'expired_or_invalid', message: 'This day pass has expired or is invalid.' })
    }

    if (payload.type !== 'daypass') {
      return res.json({ ok: false, reason: 'wrong_type', message: 'Not a day pass QR code.' })
    }

    const { rows } = await tenantQuery(
      req.tenant.slug,
      `SELECT * FROM day_passes WHERE id = $1 LIMIT 1`,
      [payload.sub],
    )
    const passData = rows[0] as Record<string, unknown> | undefined

    if (!passData) return res.json({ ok: false, reason: 'not_found', message: 'Day pass not found.' })
    if (passData.status === 'used') return res.json({ ok: false, reason: 'already_used', message: 'This day pass has already been used.' })
    if (passData.status === 'expired' || passData.status === 'refunded') {
      return res.json({ ok: false, reason: passData.status, message: `Day pass is ${passData.status}.` })
    }

    // Mark as used and record check-in time
    await tenantQuery(
      req.tenant.slug,
      `UPDATE day_passes SET status = 'used', checked_in_at = NOW() WHERE id = $1`,
      [payload.sub],
    )

    res.json({
      ok: true,
      guest_name: passData.guest_name,
      pass_type: passData.pass_type,
      valid_date: passData.valid_date,
    })
  } catch (err) {
    console.error('[day-passes/verify]', err)
    res.status(500).json({ error: 'Verification failed.' })
  }
})

// ─── POST /api/day-passes/initiate-payment ────────────────────────────────────
// Initiate a Tranzak MoMo payment for a day pass.

dayPassesRouter.post('/initiate-payment', async (req, res) => {
  try {
    const { guest_name, guest_phone, guest_email, pass_type, currency } = req.body
    if (!guest_name || !pass_type) {
      return res.status(400).json({ error: 'guest_name and pass_type are required.' })
    }
    if (!DAY_PASS_PRICES[pass_type]) {
      return res.status(400).json({ error: `Invalid pass_type. Valid: ${Object.keys(DAY_PASS_PRICES).join(', ')}` })
    }

    const amount = DAY_PASS_PRICES[pass_type]
    const dayPassId = uuid()
    const validDate = new Date().toISOString().split('T')[0]

    // Pre-create the day pass as pending
    const midnight = new Date()
    midnight.setHours(23, 59, 59, 999)
    const qrJwt = jwt.sign(
      { sub: dayPassId, type: 'daypass', guest: guest_name, pass_type, valid_date: validDate },
      process.env.JWT_SECRET!,
      { expiresIn: Math.floor((midnight.getTime() - Date.now()) / 1000) },
    )

    await tenantQuery(
      req.tenant.slug,
      `INSERT INTO day_passes (id, guest_name, guest_phone, pass_type, amount, currency, payment_method, qr_token, status, valid_date, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'tranzak', $7, 'pending', $8, NOW())`,
      [dayPassId, guest_name, guest_phone ?? null, pass_type, amount, currency ?? 'XAF', qrJwt, validDate],
    )

    // Fetch per-tenant Tranzak credentials
    const { rows } = await globalQuery<{ tranzak_app_id: string; tranzak_app_secret: string }>(
      `SELECT tranzak_app_id, tranzak_app_secret FROM tenants WHERE slug = $1 LIMIT 1`,
      [req.tenant.slug],
    )
    const tenantCreds = rows[0]

    // Initialise Tranzak payment
    const appId  = tenantCreds?.tranzak_app_id     || process.env.TRANZAK_APP_ID
    const appKey = tenantCreds?.tranzak_app_secret  || process.env.TRANZAK_APP_KEY  // stored as app_secret column, but API field is appKey
    if (!appId || !appKey) {
      return res.status(503).json({ error: 'Payment provider not configured. Please contact support.' })
    }
    const TZBASE = process.env.TRANZAK_ENV === 'live' ? 'https://dsapi.tranzak.me' : 'https://sandbox.dsapi.tranzak.me'
    const APP_URL = process.env.APP_URL ?? 'https://app.myfiti.app'

    // Authenticate — response: { data: { token, expiresIn }, success: true }
    const authRes = await fetch(`${TZBASE}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId, appKey }),
    })
    if (!authRes.ok) throw new Error(`Tranzak auth failed: ${authRes.status}`)
    const authBody = await authRes.json() as { data: { token: string }; success: boolean }
    if (!authBody.success || !authBody.data?.token) throw new Error('Tranzak auth: missing token')
    const token = authBody.data.token

    const mchTransactionRef = `dp-${dayPassId}`

    // callbackUrl — server webhook with context in query params (Tranzak ignores customData)
    const callbackUrl = `${APP_URL}/api/webhooks/tranzak?ctx=daypass&tenant=${req.tenant.slug}&id=${dayPassId}`

    const paymentRes = await fetch(`${TZBASE}/xp021/v1/request/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        amount,
        currencyCode: currency ?? 'XAF',
        description: `Day pass (${pass_type}) — ${guest_name}`,
        mchTransactionRef,                                              // correct field name
        callbackUrl,                                                     // server webhook
        returnUrl: `${APP_URL}/kiosk/success?ref=${mchTransactionRef}`, // browser redirect
      }),
    })
    if (!paymentRes.ok) {
      const errText = await paymentRes.text()
      throw new Error(`Tranzak create error: ${errText}`)
    }
    // Response: { data: { requestId, links: { paymentAuthUrl } }, success: true }
    const paymentData = await paymentRes.json() as { data?: { requestId: string; links?: { paymentAuthUrl?: string } }; success?: boolean }
    const paymentUrl  = paymentData?.data?.links?.paymentAuthUrl ?? ''

    res.status(201).json({
      ok: true,
      day_pass_id: dayPassId,
      payment_url: paymentUrl,
      merchant_transaction_id: mchTransactionRef,
      amount,
      currency: currency ?? 'XAF',
      qr_token: qrJwt,
      valid_date: validDate,
    })
  } catch (err) {
    console.error('[day-passes/initiate-payment]', err)
    res.status(500).json({ error: 'Failed to initiate payment.' })
  }
})

// ─── POST /api/day-passes/charge ─────────────────────────────────────────────
// S2S mobile wallet charge — sends USSD push to guest's phone (no redirect).
// Kiosk uses this for MTN MoMo / Orange Money when guest's phone number is known.

dayPassesRouter.post('/charge', async (req, res) => {
  try {
    const { guest_name, guest_phone, pass_type, currency } = req.body as {
      guest_name: string; guest_phone: string
      pass_type: string; currency?: string
    }

    if (!guest_name || !guest_phone || !pass_type) {
      return res.status(400).json({ error: 'guest_name, guest_phone and pass_type are required.' })
    }
    if (!DAY_PASS_PRICES[pass_type]) {
      return res.status(400).json({ error: `Invalid pass_type. Valid: ${Object.keys(DAY_PASS_PRICES).join(', ')}` })
    }
    if (!process.env.TRANZAK_APP_ID || !process.env.TRANZAK_APP_KEY) {
      return res.status(503).json({ error: 'Payment provider not configured.' })
    }

    const amount     = DAY_PASS_PRICES[pass_type]
    const dayPassId  = uuid()
    const validDate  = new Date().toISOString().split('T')[0]
    const curr       = currency ?? 'XAF'
    const midnight   = new Date()
    midnight.setHours(23, 59, 59, 999)

    const qrJwt = jwt.sign(
      { sub: dayPassId, type: 'daypass', guest: guest_name, pass_type, valid_date: validDate },
      process.env.JWT_SECRET!,
      { expiresIn: Math.floor((midnight.getTime() - Date.now()) / 1000) },
    )

    // Pre-create pending day pass
    await tenantQuery(
      req.tenant.slug,
      `INSERT INTO day_passes (id, guest_name, guest_phone, pass_type, amount, currency, payment_method, qr_token, status, valid_date, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'tranzak', $7, 'pending', $8, NOW())`,
      [dayPassId, guest_name, guest_phone, pass_type, amount, curr, qrJwt, validDate],
    )

    const reference  = `dp-${dayPassId}`
    const APP_URL    = process.env.APP_URL ?? 'https://app.myfiti.app'
    const callbackUrl = `${APP_URL}/api/webhooks/tranzak?ctx=daypass&tenant=${req.tenant.slug}&id=${dayPassId}`

    // S2S USSD push — no redirect needed
    const { requestId, status } = await chargeMobileWallet({
      amount,
      currency: curr,
      phone: guest_phone,
      reference,
      description: `Day pass (${pass_type}) — ${guest_name}`,
      payerNote:   'Gym day pass payment',
      callbackUrl,
    })

    // Store Tranzak requestId so status polling can verify live
    await tenantQuery(
      req.tenant.slug,
      `UPDATE day_passes SET tranzak_ref = $1 WHERE id = $2`,
      [requestId, dayPassId],
    )

    res.status(201).json({
      ok: true,
      day_pass_id: dayPassId,
      request_id: requestId,
      qr_token: qrJwt,
      amount,
      currency: curr,
      status,
    })
  } catch (err) {
    console.error('[day-passes/charge]', err)
    res.status(500).json({ error: 'Failed to initiate mobile money charge.' })
  }
})

// ─── GET /api/day-passes/payment-status/:ref ──────────────────────────────────
// Poll for payment status. If pending + tranzak_ref exists, live-polls Tranzak
// and activates the day pass on confirmation.

dayPassesRouter.get('/payment-status/:ref', async (req, res) => {
  try {
    const { ref } = req.params
    const dayPassId = ref.replace('dp-', '')

    const { rows } = await tenantQuery<{ status: string; qr_token: string; tranzak_ref: string | null }>(
      req.tenant.slug,
      `SELECT status, qr_token, tranzak_ref FROM day_passes WHERE id = $1 LIMIT 1`,
      [dayPassId],
    )
    const passData = rows[0]
    if (!passData) return res.status(404).json({ error: 'not_found' })

    // Live-poll Tranzak if still pending and we have a requestId
    if (passData.status === 'pending' && passData.tranzak_ref) {
      try {
        const verification = await tranzak.verifyTransaction(passData.tranzak_ref)
        if (verification.status === 'successful') {
          await tenantQuery(
            req.tenant.slug,
            `UPDATE day_passes SET status = 'active' WHERE id = $1`,
            [dayPassId],
          )
          passData.status = 'active'
        } else if (verification.status === 'failed') {
          await tenantQuery(
            req.tenant.slug,
            `UPDATE day_passes SET status = 'expired' WHERE id = $1`,
            [dayPassId],
          )
          passData.status = 'expired'
        }
      } catch { /* keep returning pending — network hiccup */ }
    }

    res.json({
      status: passData.status,
      confirmed: passData.status === 'active' || passData.status === 'used',
      qr_token: passData.status !== 'pending' ? passData.qr_token : null,
    })
  } catch (err) {
    console.error('[day-passes/payment-status]', err)
    res.status(500).json({ error: 'Failed to check payment status.' })
  }
})

// ─── POST /api/day-passes/kiosk-issue ────────────────────────────────────────
// Public endpoint — kiosk issues a day pass after collecting payment in-person.
// No staff JWT required; tenant resolved via X-Tenant-Slug header.

dayPassesRouter.post('/kiosk-issue', async (req, res) => {
  try {
    const { guest_name, guest_phone, pass_type, payment_method, currency } = req.body
    if (!guest_name || !pass_type) {
      return res.status(400).json({ error: 'guest_name and pass_type are required.' })
    }
    if (!DAY_PASS_PRICES[pass_type]) {
      return res.status(400).json({ error: `Invalid pass_type. Valid: ${Object.keys(DAY_PASS_PRICES).join(', ')}` })
    }

    const id = uuid()
    const amount = DAY_PASS_PRICES[pass_type]
    const validDate = new Date().toISOString().split('T')[0]
    const midnight = new Date()
    midnight.setHours(23, 59, 59, 999)

    const qrJwt = jwt.sign(
      { sub: id, type: 'daypass', guest: guest_name, pass_type, valid_date: validDate },
      process.env.JWT_SECRET!,
      { expiresIn: Math.floor((midnight.getTime() - Date.now()) / 1000) },
    )

    await tenantQuery(
      req.tenant.slug,
      `INSERT INTO day_passes (id, guest_name, guest_phone, pass_type, amount, currency, payment_method, qr_token, status, valid_date, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, NOW())`,
      [id, guest_name, guest_phone ?? null, pass_type, amount, currency ?? 'XAF', payment_method ?? 'cash', qrJwt, validDate],
    )

    // Record check-in immediately
    await tenantQuery(
      req.tenant.slug,
      `INSERT INTO check_ins (id, member_id, method, notes, checked_in_at) VALUES ($1, NULL, 'daypass', $2, NOW())`,
      [uuid(), `Day pass: ${guest_name}`],
    )

    res.status(201).json({ id, ok: true, qr_token: qrJwt, amount, currency: currency ?? 'XAF', valid_until: midnight.toISOString() })
  } catch (err) {
    console.error('[day-passes/kiosk-issue]', err)
    res.status(500).json({ error: 'Failed to issue day pass.' })
  }
})

// ─── POST /api/day-passes/:id/sms-receipt ─────────────────────────────────────
// Public — kiosk can send SMS receipt without staff JWT.

dayPassesRouter.post('/:id/sms-receipt', async (req, res) => {
  try {
    const { id } = req.params
    const { rows } = await tenantQuery(
      req.tenant.slug,
      `SELECT * FROM day_passes WHERE id = $1 LIMIT 1`,
      [id],
    )
    const passData = rows[0] as Record<string, unknown> | undefined
    if (!passData) return res.status(404).json({ error: 'Day pass not found.' })

    const phone = (req.body.phone as string) || (passData.guest_phone as string)
    if (!phone) return res.status(400).json({ error: 'phone is required.' })

    const { rows: tenantRows } = await tenantQuery<{ gym_name: string }>(
      req.tenant.slug,
      `SELECT gym_name FROM gym_settings WHERE id = 'singleton' LIMIT 1`,
    )
    const gymName = tenantRows[0]?.gym_name ?? req.tenant.slug

    const message = [
      `${gymName} Day Pass`,
      `Guest: ${passData.guest_name}`,
      `Type: ${passData.pass_type}`,
      `Valid: ${passData.valid_date}`,
      `Amount: ${passData.currency} ${(passData.amount as number).toLocaleString()}`,
      `Ref: DP-${(id as string).slice(0, 8).toUpperCase()}`,
      `Powered by myfiti.app`,
    ].join('\n')

    const AT_API_KEY = process.env.AT_API_KEY
    const AT_USERNAME = process.env.AT_USERNAME ?? 'sandbox'
    if (AT_API_KEY) {
      const body = new URLSearchParams({ username: AT_USERNAME, to: phone, message, from: process.env.AT_SENDER_ID ?? 'myfiti' })
      const smsRes = await fetch('https://api.africastalking.com/version1/messaging', {
        method: 'POST',
        headers: { apiKey: AT_API_KEY, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })
      if (!smsRes.ok) {
        const errText = await smsRes.text()
        console.warn('[day-passes/sms-receipt] AT error:', errText)
        return res.status(502).json({ error: 'SMS sending failed.' })
      }
    } else {
      console.log(`[day-passes/sms-receipt] AT_API_KEY not set. Would send to ${phone}:\n${message}`)
    }
    res.json({ ok: true, phone })
  } catch (err) {
    console.error('[day-passes/:id/sms-receipt]', err)
    res.status(500).json({ error: 'Failed to send SMS receipt.' })
  }
})

// Routes below require auth + staff role
dayPassesRouter.use(requireAuth)
dayPassesRouter.use(requireRole('owner', 'admin', 'receptionist'))

// ─── POST /api/day-passes/issue ───────────────────────────────────────────────
// Issue a new day pass (staff endpoint, requires auth)

dayPassesRouter.post('/issue', async (req, res) => {
  try {
    const { guest_name, guest_phone, guest_email, pass_type, payment_method, payment_ref, currency, staff_id, notes } = req.body
    if (!guest_name || !pass_type) {
      return res.status(400).json({ error: 'guest_name and pass_type are required.' })
    }
    if (!DAY_PASS_PRICES[pass_type]) {
      return res.status(400).json({ error: `Invalid pass_type. Valid: ${Object.keys(DAY_PASS_PRICES).join(', ')}` })
    }

    const id = uuid()
    const amount = DAY_PASS_PRICES[pass_type]
    const validDate = new Date().toISOString().split('T')[0]

    const midnight = new Date()
    midnight.setHours(23, 59, 59, 999)

    const qrJwt = jwt.sign(
      { sub: id, type: 'daypass', guest: guest_name, pass_type, valid_date: validDate },
      process.env.JWT_SECRET!,
      { expiresIn: Math.floor((midnight.getTime() - Date.now()) / 1000) },
    )

    await tenantQuery(
      req.tenant.slug,
      `INSERT INTO day_passes (id, guest_name, guest_phone, pass_type, amount, currency, payment_method, payment_ref, qr_token, status, valid_date, staff_id, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10, $11, $12, NOW())`,
      [id, guest_name, guest_phone ?? null, pass_type, amount, currency ?? 'XAF', payment_method ?? 'cash', payment_ref ?? null, qrJwt, validDate, staff_id ?? null, notes ?? null],
    )

    if (guest_email) {
      await paymentQueue.add('day-pass-receipt', {
        tenantSlug: req.tenant.slug,
        dayPassId: id,
        guestName: guest_name,
        guestPhone: guest_phone ?? undefined,
        guestEmail: guest_email,
        passType: pass_type,
        validDate,
        amount,
        currency: currency ?? 'XAF',
        paymentMethod: payment_method ?? 'cash',
        paymentRef: payment_ref ?? undefined,
        qrToken: qrJwt,
        issuedAt: new Date().toISOString(),
      }).catch(err => console.warn('[day-passes/issue] receipt queue error:', err))
    }

    res.status(201).json({
      id,
      ok: true,
      qr_token: qrJwt,
      amount,
      currency: currency ?? 'XAF',
      valid_date: validDate,
      valid_until: midnight.toISOString(),
    })
  } catch (err) {
    console.error('[day-passes/issue]', err)
    res.status(500).json({ error: 'Failed to issue day pass.' })
  }
})

// ─── GET /api/day-passes ──────────────────────────────────────────────────────

dayPassesRouter.get('/', async (req, res) => {
  try {
    const { from, to, status, page = '1', limit = '50' } = req.query as Record<string, string>
    const offset = (parseInt(page) - 1) * parseInt(limit)

    const params: unknown[] = []
    const conditions: string[] = []
    if (from) { params.push(from); conditions.push(`created_at >= $${params.length}`) }
    if (to) { params.push(to); conditions.push(`created_at <= $${params.length}`) }
    if (status) { params.push(status); conditions.push(`status = $${params.length}`) }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const countParams = [...params]

    params.push(parseInt(limit))
    const limitIdx = params.length
    params.push(offset)
    const offsetIdx = params.length

    const [{ rows }, { rows: totalRows }, { rows: summaryRows }] = await Promise.all([
      tenantQuery(
        req.tenant.slug,
        `SELECT * FROM day_passes ${where}
         ORDER BY created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params,
      ),
      tenantQuery(
        req.tenant.slug,
        `SELECT COUNT(*) as count FROM day_passes ${where}`,
        countParams,
      ),
      tenantQuery(
        req.tenant.slug,
        `SELECT
           COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE) as today_issued,
           COALESCE(SUM(amount) FILTER (WHERE created_at::date = CURRENT_DATE AND status != 'refunded'), 0) as today_revenue,
           COUNT(*) FILTER (WHERE status = 'active') as active_today
         FROM day_passes`,
      ),
    ])

    res.json({
      day_passes: rows,
      total: parseInt((totalRows[0] as { count: string })?.count ?? '0'),
      page: parseInt(page),
      limit: parseInt(limit),
      summary: summaryRows[0],
    })
  } catch (err) {
    console.error('[day-passes GET]', err)
    res.status(500).json({ error: 'Failed to load day passes.' })
  }
})

// ─── POST /api/day-passes/:id/convert ────────────────────────────────────────
// Convert a walk-in guest to a member

dayPassesRouter.post('/:id/convert', async (req, res) => {
  try {
    const { id } = req.params
    const { member_id } = req.body
    if (!member_id) return res.status(400).json({ error: 'member_id is required.' })

    await tenantQuery(
      req.tenant.slug,
      `UPDATE day_passes SET converted_to_member_id = $1 WHERE id = $2`,
      [member_id, id],
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[day-passes/:id/convert]', err)
    res.status(500).json({ error: 'Failed to convert day pass.' })
  }
})


