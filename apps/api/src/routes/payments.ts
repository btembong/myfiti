import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { tenantQuery } from '../db/client.js'
import { validate } from '../middleware/validate.js'
import { createPaymentSchema } from '../schemas.js'
import { tranzak, chargeMobileWallet } from '../lib/tranzak.js'
import { sendPaymentReminderEmail, sendMemberCashReceiptEmail } from '../lib/email.js'
import { buildThermalReceiptHTML, type MemberReceiptData } from '../lib/receipt.js'
import { invalidateSubscriptionCache } from '../lib/redis.js'
import { globalQuery } from '../db/client.js'

export const paymentsRouter = Router()

paymentsRouter.use(requireAuth)
paymentsRouter.use(requireRole('owner', 'admin', 'receptionist'))

// ─── GET /api/payments ────────────────────────────────────────────────────────
// List payments with optional filters

paymentsRouter.get('/', async (req, res) => {
  try {
    const { member_id, status, provider, from, to, page = '1', limit = '50' } = req.query as Record<string, string>
    const offset = (parseInt(page) - 1) * parseInt(limit)

    const params: unknown[] = []
    const conditions: string[] = []
    if (member_id) { params.push(member_id); conditions.push(`p.member_id = $${params.length}`) }
    if (status) { params.push(status); conditions.push(`p.status = $${params.length}`) }
    if (provider) { params.push(provider); conditions.push(`p.provider = $${params.length}`) }
    if (from) { params.push(from); conditions.push(`p.created_at >= $${params.length}`) }
    if (to) { params.push(to); conditions.push(`p.created_at <= $${params.length}`) }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const countParams = [...params]

    params.push(parseInt(limit))
    const limitIdx = params.length
    params.push(offset)
    const offsetIdx = params.length

    const [{ rows }, { rows: totalRows }, { rows: summaryRows }] = await Promise.all([
      tenantQuery(
        req.tenant.slug,
        `SELECT p.*, m.name as member_name, m.email as member_email, m.avatar_url,
                mp.name as plan_name
         FROM payments p
         JOIN members m ON m.id = p.member_id
         LEFT JOIN subscriptions s ON s.id = p.subscription_id
         LEFT JOIN membership_plans mp ON mp.id = s.plan_id
         ${where}
         ORDER BY p.created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params,
      ),
      tenantQuery(
        req.tenant.slug,
        `SELECT COUNT(*) as count FROM payments p ${where}`,
        countParams,
      ),
      tenantQuery(
        req.tenant.slug,
        `SELECT
           COALESCE(SUM(amount) FILTER (WHERE status IN ('paid', 'completed') AND paid_at >= date_trunc('month', NOW())), 0) as mtd,
           COALESCE(SUM(amount) FILTER (WHERE status IN ('paid', 'completed') AND paid_at >= date_trunc('month', NOW()) - INTERVAL '1 month' AND paid_at < date_trunc('month', NOW())), 0) as last_month,
           COALESCE(SUM(amount) FILTER (WHERE status IN ('paid', 'completed') AND paid_at::date = CURRENT_DATE), 0) as today,
           COALESCE(SUM(amount) FILTER (WHERE status IN ('paid', 'completed')), 0) as total_all_time
         FROM payments`,
      ),
    ])

    res.json({
      payments: rows,
      total: parseInt((totalRows[0] as { count: string })?.count ?? '0'),
      page: parseInt(page),
      limit: parseInt(limit),
      summary: summaryRows[0],
    })
  } catch (err) {
    console.error('[payments GET]', err)
    res.status(500).json({ error: 'Failed to load payments.' })
  }
})

// ─── GET /api/payments/export ────────────────────────────────────────────────
// Export payments as CSV

paymentsRouter.get('/export', async (req, res) => {
  try {
    const { from, to } = req.query as Record<string, string>
    const params: unknown[] = []
    const conditions: string[] = []
    if (from) { params.push(from); conditions.push(`p.created_at >= $${params.length}`) }
    if (to) { params.push(to); conditions.push(`p.created_at <= $${params.length}`) }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const { rows } = await tenantQuery(
      req.tenant.slug,
      `SELECT m.name as member_name, m.email as member_email,
              p.amount, p.currency, p.provider, p.status, p.payment_type,
              p.tranzak_ref as reference, p.paid_at, p.created_at,
              mp.name as plan_name
       FROM payments p
       JOIN members m ON m.id = p.member_id
       LEFT JOIN subscriptions s ON s.id = p.subscription_id
       LEFT JOIN membership_plans mp ON mp.id = s.plan_id
       ${where}
       ORDER BY p.created_at DESC`,
      params,
    )

    const header = 'Member,Email,Amount,Currency,Provider,Status,Type,Plan,Reference,Paid At,Created At'
    const csvRows = (rows as Array<Record<string, unknown>>).map(r =>
      [r.member_name, r.member_email, r.amount, r.currency, r.provider, r.status, r.payment_type, r.plan_name ?? '', r.reference ?? '', r.paid_at ?? '', r.created_at]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    )
    const csv = [header, ...csvRows].join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename=payments.csv')
    return res.send(csv)
  } catch (err) {
    console.error('[payments/export]', err)
    return res.status(500).json({ error: 'Failed to export payments.' })
  }
})

// ─── POST /api/payments ───────────────────────────────────────────────────────
// Record a manual payment (cash / MoMo / bank transfer).
// When a subscription_id is provided, the subscription is automatically
// activated (if pending) or renewed (if active/expired) based on plan duration.

paymentsRouter.post('/', validate(createPaymentSchema), async (req, res) => {
  try {
    const { member_id, subscription_id, amount, currency, provider, provider_ref, notes, payment_type } = req.body
    const slug = req.tenant.slug

    const id     = uuid()
    const paidAt = new Date().toISOString()

    await tenantQuery(
      slug,
      `INSERT INTO payments (id, member_id, subscription_id, amount, currency, provider, tranzak_ref, status, payment_type, paid_at, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', $8, NOW(), $9, NOW())`,
      [id, member_id, subscription_id ?? null, parseFloat(amount), currency ?? 'XAF', provider, provider_ref ?? null, payment_type ?? 'subscription', notes ?? null],
    )

    // ── Activate / extend subscription ────────────────────────────────────────
    let newExpiresAt: string | null = null
    if (subscription_id) {
      const { rows: subRows } = await tenantQuery<{
        status: string; expires_at: string; duration_days: number
      }>(
        slug,
        `SELECT s.status, s.expires_at, mp.duration_days
         FROM subscriptions s
         JOIN membership_plans mp ON mp.id = s.plan_id
         WHERE s.id = $1 LIMIT 1`,
        [subscription_id],
      )
      const sub = subRows[0]
      if (sub) {
        // If active/expiring_soon → extend from current expiry; otherwise from today
        const base = (sub.status === 'active' || sub.status === 'expiring_soon') && sub.expires_at
          ? new Date(sub.expires_at)
          : new Date()
        base.setDate(base.getDate() + sub.duration_days)
        newExpiresAt = base.toISOString()

        await tenantQuery(
          slug,
          `UPDATE subscriptions
           SET status = 'active', expires_at = $1, grace_expires_at = NULL, updated_at = NOW()
           WHERE id = $2`,
          [newExpiresAt, subscription_id],
        )

        // Invalidate member subscription cache
        const { rows: tRows } = await globalQuery<{ id: string }>(
          `SELECT id FROM tenants WHERE slug = $1 LIMIT 1`, [slug],
        )
        if (tRows[0]) {
          await invalidateSubscriptionCache(tRows[0].id, member_id).catch(() => {})
        }
      }
    }

    // ── Build receipt data ─────────────────────────────────────────────────────
    const { rows: memberRows } = await tenantQuery<{
      name: string; email: string | null; phone: string | null
    }>(slug, `SELECT name, email, phone FROM members WHERE id = $1 LIMIT 1`, [member_id])

    const { rows: planRows } = await tenantQuery<{ name: string; started_at: string }>(
      slug,
      `SELECT mp.name, s.started_at FROM subscriptions s
       JOIN membership_plans mp ON mp.id = s.plan_id
       WHERE s.id = $1 LIMIT 1`,
      [subscription_id ?? ''],
    )

    const { rows: gymRows } = await globalQuery<{ name: string }>(
      `SELECT name FROM tenants WHERE slug = $1 LIMIT 1`, [slug],
    )

    const member   = memberRows[0]
    const gymName  = gymRows[0]?.name ?? slug
    const receiptNo = `REC-${id.slice(0, 8).toUpperCase()}`
    const today    = new Date().toISOString().slice(0, 10)

    const receiptData: MemberReceiptData = {
      type:        'subscription',
      receiptNo,
      gymName,
      memberName:  member?.name ?? 'Member',
      memberEmail: member?.email ?? undefined,
      memberPhone: member?.phone ?? undefined,
      planName:    planRows[0]?.name ?? (payment_type ?? 'Membership'),
      startDate:   planRows[0]?.started_at?.slice(0, 10) ?? today,
      expiresDate: newExpiresAt?.slice(0, 10) ?? today,
      amount:      parseFloat(amount),
      currency:    currency ?? 'XAF',
      provider,
      providerRef: provider_ref ?? undefined,
      paidAt,
    }

    // ── Build thermal receipt HTML for browser printing ────────────────────────
    const thermalHtml = await buildThermalReceiptHTML(receiptData).catch(() => null)

    // ── Send email instantly to member (not queued) ────────────────────────────
    let emailSent = false
    if (member?.email) {
      sendMemberCashReceiptEmail({
        to:        { email: member.email, name: member.name },
        gymName,
        memberId:  member_id,
        data:      receiptData,
      }).then(() => { emailSent = true })
        .catch(err => console.warn('[payments POST] receipt email error:', err))
    }

    res.status(201).json({
      id,
      ok: true,
      new_expires_at: newExpiresAt,
      email_sent: emailSent,
      member_email: member?.email ?? null,
      receipt: {
        receipt_no:   receiptNo,
        member_name:  receiptData.memberName,
        plan_name:    receiptData.planName,
        amount:       receiptData.amount,
        currency:     receiptData.currency,
        provider,
        expires_date: receiptData.expiresDate,
        paid_at:      paidAt,
        gym_name:     gymName,
        thermal_html: thermalHtml,
      },
    })
  } catch (err) {
    console.error('[payments POST]', err)
    res.status(500).json({ error: 'Failed to record payment.' })
  }
})

// ─── POST /api/payments/tranzak/initiate ─────────────────────────────────────
// Create a Tranzak Mobile Money payment request for a member.
// Returns a payment_url the member opens on their phone to approve the payment.
// Payment is recorded as 'pending' and confirmed via webhook when approved.

paymentsRouter.post('/tranzak/initiate', async (req, res) => {
  try {
    const { member_id, subscription_id, amount, currency, payment_type } = req.body as {
      member_id: string; subscription_id?: string
      amount: number; currency?: string; payment_type?: string
    }

    if (!member_id || !amount) {
      return res.status(400).json({ error: 'member_id and amount are required.' })
    }

    if (!process.env.TRANZAK_APP_ID || !process.env.TRANZAK_APP_KEY) {
      return res.status(503).json({ error: 'Tranzak is not configured. Add TRANZAK_APP_ID and TRANZAK_APP_KEY to your environment.' })
    }

    const id        = uuid()
    const slug      = req.tenant.slug
    const curr      = currency ?? 'XAF'
    const reference = `mem-${id}`
    const APP_URL   = process.env.APP_URL ?? 'https://app.myfiti.app'

    // Record as pending first so it exists before the webhook fires
    await tenantQuery(
      slug,
      `INSERT INTO payments (id, member_id, subscription_id, amount, currency, provider, tranzak_ref, status, payment_type, created_at)
       VALUES ($1, $2, $3, $4, $5, 'tranzak', $6, 'pending', $7, NOW())`,
      [id, member_id, subscription_id ?? null, amount, curr, reference, payment_type ?? 'subscription'],
    )

    // Fetch member email for Tranzak customData
    const { rows: memberRows } = await tenantQuery<{ email: string | null }>(
      slug, `SELECT email FROM members WHERE id = $1 LIMIT 1`, [member_id],
    )

    const link = await tranzak.initializeTransaction({
      amount,
      currency: curr,
      email: memberRows[0]?.email ?? '',
      reference,
      callback_url: `${APP_URL}/payment/success?ref=${reference}`,  // browser redirect
      metadata: {
        ctx:    'member',          // used to build per-request callbackUrl in tranzak.ts
        tenant: slug,
        id,
      },
    })

    return res.json({ ok: true, payment_id: id, payment_url: link.payment_url })
  } catch (err) {
    console.error('[payments/tranzak/initiate]', err)
    return res.status(500).json({ error: 'Failed to initiate Tranzak payment.' })
  }
})

// ─── POST /api/payments/tranzak/charge ───────────────────────────────────────
// Server-to-server mobile money charge — no redirect needed.
// Sends a USSD push to the member's phone. They confirm on handset.
// Use this from the mobile app renewal flow.

paymentsRouter.post('/tranzak/charge', async (req, res) => {
  try {
    const { member_id, subscription_id, amount, currency, payment_type, phone } = req.body as {
      member_id: string; subscription_id?: string
      amount: number; currency?: string; payment_type?: string
      phone: string  // e.g. "237655123456" — full international format
    }

    if (!member_id || !amount || !phone) {
      return res.status(400).json({ error: 'member_id, amount and phone are required.' })
    }
    if (!process.env.TRANZAK_APP_ID || !process.env.TRANZAK_APP_KEY) {
      return res.status(503).json({ error: 'Tranzak is not configured.' })
    }

    const id        = uuid()
    const slug      = req.tenant.slug
    const curr      = currency ?? 'XAF'
    const reference = `mem-${id}`
    const APP_URL   = process.env.APP_URL ?? 'https://app.myfiti.app'

    // Record as pending before calling Tranzak
    await tenantQuery(
      slug,
      `INSERT INTO payments (id, member_id, subscription_id, amount, currency, provider, tranzak_ref, status, payment_type, created_at)
       VALUES ($1, $2, $3, $4, $5, 'tranzak', $6, 'pending', $7, NOW())`,
      [id, member_id, subscription_id ?? null, amount, curr, reference, payment_type ?? 'subscription'],
    )

    const { requestId, status } = await chargeMobileWallet({
      amount,
      currency: curr,
      phone,
      reference,
      description: `Gym membership — ${slug}`,
      callbackUrl: `${APP_URL}/api/webhooks/tranzak?ctx=member&tenant=${slug}&id=${id}`,
    })

    // Store Tranzak requestId for status polling
    await tenantQuery(slug,
      `UPDATE payments SET tranzak_ref = $1 WHERE id = $2`,
      [requestId, id],
    )

    return res.json({ ok: true, payment_id: id, request_id: requestId, status })
  } catch (err) {
    console.error('[payments/tranzak/charge]', err)
    return res.status(500).json({ error: 'Failed to initiate mobile money charge.' })
  }
})

// ─── GET /api/payments/summary ────────────────────────────────────────────────
// Quick summary stats combining subscription payments and day pass revenue.

paymentsRouter.get('/summary', async (req, res) => {
  try {
    const { rows } = await tenantQuery(
      req.tenant.slug,
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE src='sub' AND status IN ('paid','completed') AND ts::date = CURRENT_DATE), 0) as sub_today,
         COALESCE(SUM(amount) FILTER (WHERE src='dp'  AND status IN ('active','used')              AND ts::date = CURRENT_DATE), 0) as dp_today,
         COALESCE(SUM(amount) FILTER (WHERE src='sub' AND status IN ('paid','completed') AND ts >= date_trunc('month',NOW())), 0) as sub_mtd,
         COALESCE(SUM(amount) FILTER (WHERE src='dp'  AND status IN ('active','used')              AND ts >= date_trunc('month',NOW())), 0) as dp_mtd,
         COALESCE(SUM(amount) FILTER (WHERE src='sub' AND status IN ('paid','completed') AND ts >= date_trunc('month',NOW()) - INTERVAL '1 month' AND ts < date_trunc('month',NOW())), 0) as sub_last_month,
         COALESCE(SUM(amount) FILTER (WHERE src='dp'  AND status IN ('active','used')              AND ts >= date_trunc('month',NOW()) - INTERVAL '1 month' AND ts < date_trunc('month',NOW())), 0) as dp_last_month,
         COALESCE(SUM(amount) FILTER (WHERE src='sub' AND status IN ('paid','completed')), 0) as sub_total,
         COALESCE(SUM(amount) FILTER (WHERE src='dp'  AND status IN ('active','used')), 0) as dp_total,
         COUNT(*)  FILTER (WHERE src='sub' AND status = 'pending') as pending_count,
         COUNT(*)  FILTER (WHERE src='sub' AND status = 'failed')  as failed_count,
         COUNT(*)  FILTER (WHERE src='dp'  AND status IN ('active','used') AND ts::date = CURRENT_DATE) as dp_today_count
       FROM (
         SELECT amount, status::text, COALESCE(paid_at, created_at) as ts, 'sub' as src FROM payments
         UNION ALL
         SELECT amount, status::text, created_at as ts, 'dp' as src FROM day_passes
       ) t`,
    )
    const r = rows[0] as Record<string, string>
    const subToday     = parseFloat(r.sub_today     ?? '0')
    const dpToday      = parseFloat(r.dp_today      ?? '0')
    const subMtd       = parseFloat(r.sub_mtd       ?? '0')
    const dpMtd        = parseFloat(r.dp_mtd        ?? '0')
    const subLastMonth = parseFloat(r.sub_last_month ?? '0')
    const dpLastMonth  = parseFloat(r.dp_last_month  ?? '0')
    const subTotal     = parseFloat(r.sub_total     ?? '0')
    const dpTotal      = parseFloat(r.dp_total      ?? '0')
    res.json({
      today:          subToday + dpToday,
      mtd:            subMtd + dpMtd,
      last_month:     subLastMonth + dpLastMonth,
      total_all_time: subTotal + dpTotal,
      sub_today:      subToday,
      dp_today:       dpToday,
      sub_mtd:        subMtd,
      dp_mtd:         dpMtd,
      sub_last_month: subLastMonth,
      dp_last_month:  dpLastMonth,
      sub_total:      subTotal,
      dp_total:       dpTotal,
      pending_count:  parseInt(r.pending_count ?? '0'),
      failed_count:   parseInt(r.failed_count  ?? '0'),
      dp_today_count: parseInt(r.dp_today_count ?? '0'),
    })
  } catch (err) {
    console.error('[payments/summary GET]', err)
    res.status(500).json({ error: 'Failed to load payment summary.' })
  }
})

// ─── GET /api/payments/:id ────────────────────────────────────────────────────
// Fetch a single payment by ID (used by admin UI for S2S polling).

paymentsRouter.get('/:id', async (req, res) => {
  try {
    const { rows } = await tenantQuery<{
      id: string; status: string; amount: string; currency: string
      provider: string; tranzak_ref: string | null; payment_type: string
      paid_at: string | null; created_at: string
    }>(
      req.tenant.slug,
      `SELECT id, status, amount, currency, provider, tranzak_ref, payment_type, paid_at, created_at
       FROM payments WHERE id = $1 LIMIT 1`,
      [req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ error: 'Payment not found.' })

    const p = rows[0]
    // Live-poll Tranzak if still pending
    if (p.status === 'pending' && p.tranzak_ref) {
      try {
        const v = await tranzak.verifyTransaction(p.tranzak_ref)
        if (v.status === 'successful') {
          await tenantQuery(req.tenant.slug,
            `UPDATE payments SET status = 'completed', paid_at = NOW() WHERE id = $1`, [p.id])
          p.status = 'completed'
        } else if (v.status === 'failed') {
          await tenantQuery(req.tenant.slug,
            `UPDATE payments SET status = 'failed' WHERE id = $1`, [p.id])
          p.status = 'failed'
        }
      } catch { /* keep returning pending */ }
    }

    res.json({ id: p.id, status: p.status, amount: parseFloat(p.amount), currency: p.currency })
  } catch (err) {
    console.error('[payments/:id GET]', err)
    res.status(500).json({ error: 'Failed to fetch payment.' })
  }
})

// ─── PATCH /api/payments/:id ──────────────────────────────────────────────────
// Update payment status (e.g., mark pending as completed/failed)

paymentsRouter.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { status, provider_ref, notes } = req.body

    const params: unknown[] = []
    const sets: string[] = []
    if (status) {
      params.push(status)
      sets.push(`status = $${params.length}`)
      if (status === 'completed') sets.push('paid_at = NOW()')
    }
    if (provider_ref) { params.push(provider_ref); sets.push(`tranzak_ref = $${params.length}`) }
    if (notes) { params.push(notes); sets.push(`notes = $${params.length}`) }

    if (!sets.length) return res.status(400).json({ error: 'Nothing to update.' })

    params.push(id)
    await tenantQuery(
      req.tenant.slug,
      `UPDATE payments SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params,
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[payments/:id PATCH]', err)
    res.status(500).json({ error: 'Failed to update payment.' })
  }
})

// ─── POST /api/payments/:id/resend-receipt ───────────────────────────────────
// Re-send the receipt email for a completed payment to the member's email.

paymentsRouter.post('/:id/resend-receipt', async (req, res) => {
  try {
    const slug = req.tenant.slug

    const { rows } = await tenantQuery<{
      id: string; member_id: string; amount: string; currency: string
      provider: string; tranzak_ref: string | null; status: string
      payment_type: string; paid_at: string | null; subscription_id: string | null
    }>(slug, `SELECT * FROM payments WHERE id = $1 LIMIT 1`, [req.params.id])

    const payment = rows[0]
    if (!payment) return res.status(404).json({ error: 'Payment not found.' })
    if (payment.status !== 'completed') return res.status(400).json({ error: 'Can only resend receipts for completed payments.' })

    const { rows: mRows } = await tenantQuery<{ name: string; email: string | null; phone: string | null }>(
      slug, `SELECT name, email, phone FROM members WHERE id = $1 LIMIT 1`, [payment.member_id],
    )
    const member = mRows[0]
    if (!member?.email) return res.status(422).json({ error: 'Member has no email address on file.' })

    const { rows: planRows } = await tenantQuery<{ name: string; expires_at: string; started_at: string }>(
      slug,
      `SELECT mp.name, s.expires_at, s.started_at FROM subscriptions s
       JOIN membership_plans mp ON mp.id = s.plan_id
       WHERE s.id = $1 LIMIT 1`,
      [payment.subscription_id ?? ''],
    )
    const { rows: gymRows } = await globalQuery<{ name: string }>(
      `SELECT name FROM tenants WHERE slug = $1 LIMIT 1`, [slug],
    )

    const gymName   = gymRows[0]?.name ?? slug
    const receiptNo = `REC-${payment.id.slice(0, 8).toUpperCase()}`
    const today     = new Date().toISOString().slice(0, 10)

    const receiptData: MemberReceiptData = {
      type:        'subscription',
      receiptNo,
      gymName,
      memberName:  member.name,
      memberEmail: member.email,
      memberPhone: member.phone ?? undefined,
      planName:    planRows[0]?.name ?? payment.payment_type,
      startDate:   planRows[0]?.started_at?.slice(0, 10) ?? today,
      expiresDate: planRows[0]?.expires_at?.slice(0, 10) ?? today,
      amount:      parseFloat(payment.amount),
      currency:    payment.currency,
      provider:    payment.provider,
      providerRef: payment.tranzak_ref ?? undefined,
      paidAt:      payment.paid_at ?? new Date().toISOString(),
    }

    await sendMemberCashReceiptEmail({
      to:       { email: member.email, name: member.name },
      gymName,
      memberId: payment.member_id,
      data:     receiptData,
    })

    res.json({ ok: true, sent_to: member.email })
  } catch (err) {
    console.error('[payments/:id/resend-receipt]', err)
    res.status(500).json({ error: 'Failed to resend receipt.' })
  }
})

// ─── POST /api/payments/:id/remind ───────────────────────────────────────────
// Send a payment reminder email to the member

paymentsRouter.post('/:id/remind', async (req, res) => {
  try {
    const { id } = req.params

    const { rows } = await tenantQuery<{
      amount: number; currency: string; status: string
      member_name: string; member_email: string
      plan_name: string | null; due_date: string | null
    }>(
      req.tenant.slug,
      `SELECT p.amount, p.currency, p.status,
              m.name AS member_name, m.email AS member_email,
              mp.name AS plan_name,
              p.created_at AS due_date
       FROM payments p
       JOIN members m ON m.id = p.member_id
       LEFT JOIN subscriptions s ON s.id = p.subscription_id
       LEFT JOIN membership_plans mp ON mp.id = s.plan_id
       WHERE p.id = $1 LIMIT 1`,
      [id],
    )
    const payment = rows[0]
    if (!payment) return res.status(404).json({ error: 'Payment not found.' })
    if (!payment.member_email) return res.status(400).json({ error: 'Member has no email address.' })

    await sendPaymentReminderEmail(
      { email: payment.member_email, name: payment.member_name },
      req.tenant.name,
      payment.amount,
      payment.currency ?? 'XAF',
      payment.plan_name,
      payment.due_date,
    )

    return res.json({ ok: true })
  } catch (err) {
    console.error('[payments/:id/remind POST]', err)
    return res.status(500).json({ error: 'Failed to send reminder.' })
  }
})

// ─── POST /api/payments/:id/refund ──────────────────────────────────────────
// Refund a completed payment and optionally cancel the linked subscription

paymentsRouter.post('/:id/refund', async (req, res) => {
  try {
    const { id } = req.params
    const { reason, cancel_subscription } = req.body as { reason?: string; cancel_subscription?: boolean }

    // Fetch the payment
    const { rows } = await tenantQuery<{ status: string; subscription_id: string | null; member_id: string }>(
      req.tenant.slug,
      `SELECT status, subscription_id, member_id FROM payments WHERE id = $1 LIMIT 1`,
      [id],
    )
    const payment = rows[0]
    if (!payment) return res.status(404).json({ error: 'Payment not found.' })
    if (payment.status !== 'completed') {
      return res.status(400).json({ error: 'Only completed payments can be refunded.' })
    }

    // Mark payment as refunded
    await tenantQuery(
      req.tenant.slug,
      `UPDATE payments SET status = 'refunded', notes = COALESCE(notes, '') || $1 WHERE id = $2`,
      [reason ? `\nRefund: ${reason}` : '\nRefunded', id],
    )

    // Optionally cancel the linked subscription
    if (cancel_subscription && payment.subscription_id) {
      await tenantQuery(
        req.tenant.slug,
        `UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND status IN ('active', 'expiring_soon', 'grace_period')`,
        [payment.subscription_id],
      )
    }

    res.json({ ok: true })
  } catch (err) {
    console.error('[payments/:id/refund]', err)
    res.status(500).json({ error: 'Failed to refund payment.' })
  }
})
