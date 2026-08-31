import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { tenantQuery } from '../db/client.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { createMemberSchema, updateMemberSchema, importMembersSchema } from '../schemas.js'
import { sendAnnouncementEmail, sendMemberWelcomeEmail } from '../lib/email.js'

export const membersRouter = Router()

membersRouter.use(requireAuth)
membersRouter.use(requireRole('owner', 'admin', 'receptionist', 'trainer'))

// ─── Referral code generator ──────────────────────────────────────────────────

function generateReferralCode(name: string): string {
  const prefix = name.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 4).padEnd(2, 'X')
  const suffix = Math.floor(1000 + Math.random() * 9000)
  return `${prefix}${suffix}`
}

async function uniqueReferralCode(tenantSlug: string, name: string): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateReferralCode(name)
    const { rows } = await tenantQuery<{ count: string }>(
      tenantSlug,
      `SELECT COUNT(*) as count FROM members WHERE referral_code = $1`,
      [code],
    )
    if (rows[0]?.count === '0') return code
  }
  return `REF${Date.now().toString(36).toUpperCase().slice(-6)}`
}

// ─── PIN helpers ──────────────────────────────────────────────────────────────

async function generateUniquePin(tenantSlug: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const pin = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
    const { rows } = await tenantQuery<{ count: string }>(
      tenantSlug,
      `SELECT COUNT(*) as count FROM members WHERE pin = $1`,
      [pin],
    )
    if ((rows[0]?.count ?? '1') === '0') return pin
  }
  // Extremely unlikely fallback — use last 4 digits of timestamp
  return String(Date.now()).slice(-4)
}

// ─── GET /api/members ─────────────────────────────────────────────────────────

membersRouter.get('/', async (req, res) => {
  try {
    const slug = req.tenant.slug
    const search = (req.query.search as string) ?? ''
    const status = (req.query.status as string) ?? ''
    const page  = Math.max(1, parseInt((req.query.page as string) ?? '1'))
    const limit = Math.min(200, Math.max(1, parseInt((req.query.limit as string) ?? '50')))
    const offset = (page - 1) * limit

    const params: unknown[] = []
    const conditions: string[] = []
    if (search) {
      params.push(`%${search}%`)
      const idx = params.length
      conditions.push(`(m.name ILIKE $${idx} OR m.email ILIKE $${idx} OR m.phone ILIKE $${idx})`)
    }
    if (status && status !== 'all') {
      params.push(status)
      conditions.push(`m.status = $${params.length}`)
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const countParams = [...params]

    params.push(limit, offset)
    const limitIdx  = params.length - 1
    const offsetIdx = params.length

    const [{ rows }, { rows: countRows }] = await Promise.all([
      tenantQuery(
        slug,
        `SELECT
          m.id, m.name, m.email, m.phone, m.status,
          m.qr_code, m.pin, m.avatar_url, m.notes,
          m.joined_at, m.created_at,
          sub.status    AS sub_status,
          sub.expires_at,
          plan.name     AS plan_name,
          plan.price    AS plan_price,
          plan.currency AS plan_currency
        FROM members m
        LEFT JOIN LATERAL (
          SELECT s.status, s.expires_at, s.plan_id
          FROM subscriptions s
          WHERE s.member_id = m.id
          ORDER BY s.created_at DESC
          LIMIT 1
        ) sub ON true
        LEFT JOIN membership_plans plan ON plan.id = sub.plan_id
        ${where}
        ORDER BY m.created_at DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params,
      ),
      tenantQuery(slug, `SELECT COUNT(*) as count FROM members m ${where}`, countParams),
    ])

    const total = parseInt((countRows[0] as { count: string })?.count ?? '0')
    return res.json({ members: rows, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (err) {
    console.error('[members/list]', err)
    return res.status(500).json({ error: 'Failed to fetch members.' })
  }
})

// ─── GET /api/members/:id ─────────────────────────────────────────────────────

membersRouter.get('/:id', async (req, res) => {
  try {
    const { rows } = await tenantQuery(
      req.tenant.slug,
      `SELECT
        m.*,
        sub.status    AS sub_status,
        sub.started_at,
        sub.expires_at,
        sub.auto_renew,
        plan.name     AS plan_name,
        plan.price    AS plan_price,
        plan.currency AS plan_currency,
        plan.cycle    AS plan_cycle
      FROM members m
      LEFT JOIN LATERAL (
        SELECT s.status, s.started_at, s.expires_at, s.plan_id, s.auto_renew
        FROM subscriptions s
        WHERE s.member_id = m.id
        ORDER BY s.created_at DESC
        LIMIT 1
      ) sub ON true
      LEFT JOIN membership_plans plan ON plan.id = sub.plan_id
      WHERE m.id = $1
      LIMIT 1`,
      [req.params.id],
    )

    if (!rows[0]) return res.status(404).json({ error: 'Member not found.' })
    return res.json({ member: rows[0] })
  } catch (err) {
    console.error('[members/get]', err)
    return res.status(500).json({ error: 'Failed to fetch member.' })
  }
})

// ─── POST /api/members ────────────────────────────────────────────────────────

membersRouter.post('/', validate(createMemberSchema), async (req, res) => {
  try {
    const { name, email, phone, notes, referredByCode } = req.body
    const id = uuid()
    const qrCode = `myfiti-${id.slice(0, 8).toUpperCase()}`
    const [pin, referralCode] = await Promise.all([
      generateUniquePin(req.tenant.slug),
      uniqueReferralCode(req.tenant.slug, name),
    ])

    // Resolve referrer if a code was provided
    let referredById: string | null = null
    if (referredByCode?.trim()) {
      const { rows: refRows } = await tenantQuery<{ id: string }>(
        req.tenant.slug,
        `SELECT id FROM members WHERE referral_code = $1 LIMIT 1`,
        [referredByCode.trim().toUpperCase()],
      )
      referredById = refRows[0]?.id ?? null
    }

    await tenantQuery(
      req.tenant.slug,
      `INSERT INTO members
        (id, name, email, phone, status, qr_code, pin, referral_code, referred_by_id, notes, joined_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, $8, $9, NOW(), NOW(), NOW())`,
      [id, name.trim(), email.toLowerCase().trim(), phone?.trim() ?? null, qrCode, pin, referralCode, referredById, notes?.trim() ?? null],
    )

    // Create referral record if referred
    if (referredById) {
      await tenantQuery(
        req.tenant.slug,
        `INSERT INTO referrals (id, referrer_id, referred_id, status, created_at)
         VALUES ($1, $2, $3, 'pending', NOW())`,
        [uuid(), referredById, id],
      )
    }

    // Send welcome email — best-effort, never fail the request
    sendMemberWelcomeEmail(
      { email: email.toLowerCase().trim(), name: name.trim() },
      req.tenant.name,
      qrCode,
      undefined,
      undefined,
      pin,
    ).catch(err => console.warn('[members/create] welcome email failed:', err))

    return res.status(201).json({ ok: true, id, qrCode, pin })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return res.status(409).json({ error: 'A member with this email already exists.' })
    }
    console.error('[members/create]', err)
    return res.status(500).json({ error: 'Failed to create member.' })
  }
})

// ─── PATCH /api/members/:id ───────────────────────────────────────────────────

membersRouter.patch('/:id', validate(updateMemberSchema), async (req, res) => {
  try {
    const { name, phone, notes, status } = req.body
    const sets: string[] = ['updated_at = NOW()']
    const params: unknown[] = []

    if (name) { params.push(name); sets.push(`name = $${params.length}`) }
    if (phone) { params.push(phone); sets.push(`phone = $${params.length}`) }
    if (notes !== undefined) { params.push(notes || null); sets.push(`notes = $${params.length}`) }
    if (status) { params.push(status); sets.push(`status = $${params.length}`) }

    params.push(req.params.id)

    await tenantQuery(
      req.tenant.slug,
      `UPDATE members SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params,
    )

    return res.json({ ok: true })
  } catch (err) {
    console.error('[members/update]', err)
    return res.status(500).json({ error: 'Failed to update member.' })
  }
})

// ─── DELETE /api/members/:id ─────────────────────────────────────────────────
// Soft-delete: set status to inactive and cancel active subscriptions

membersRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    await Promise.all([
      tenantQuery(
        req.tenant.slug,
        `UPDATE members SET status = 'inactive', updated_at = NOW() WHERE id = $1`,
        [id],
      ),
      tenantQuery(
        req.tenant.slug,
        `UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
         WHERE member_id = $1 AND status IN ('active', 'expiring_soon', 'grace_period')`,
        [id],
      ),
    ])
    return res.json({ ok: true })
  } catch (err) {
    console.error('[members/delete]', err)
    return res.status(500).json({ error: 'Failed to archive member.' })
  }
})

// ─── POST /api/members/:id/resend-welcome ────────────────────────────────────
// Re-send the welcome email + QR code to a member

membersRouter.post('/:id/resend-welcome', async (req, res) => {
  try {
    const { id } = req.params
    const { rows } = await tenantQuery<{
      name: string; email: string; qr_code: string
      plan_name: string | null; expires_at: string | null
    }>(
      req.tenant.slug,
      `SELECT m.name, m.email, m.qr_code,
              mp.name AS plan_name,
              sub.expires_at
       FROM members m
       LEFT JOIN LATERAL (
         SELECT s.plan_id, s.expires_at FROM subscriptions s WHERE s.member_id = m.id ORDER BY s.created_at DESC LIMIT 1
       ) sub ON true
       LEFT JOIN membership_plans mp ON mp.id = sub.plan_id
       WHERE m.id = $1 LIMIT 1`,
      [id],
    )
    const member = rows[0]
    if (!member) return res.status(404).json({ error: 'Member not found.' })

    await sendMemberWelcomeEmail(
      { email: member.email, name: member.name },
      req.tenant.name,
      member.qr_code,
      member.plan_name,
      member.expires_at,
    )

    return res.json({ ok: true })
  } catch (err) {
    console.error('[members/:id/resend-welcome]', err)
    return res.status(500).json({ error: 'Failed to resend welcome email.' })
  }
})

// ─── POST /api/members/:id/reset-pin ─────────────────────────────────────────
// Generate a new unique 4-digit kiosk PIN for a member and return it once

membersRouter.post('/:id/reset-pin', async (req, res) => {
  try {
    const { id } = req.params
    const pin = await generateUniquePin(req.tenant.slug)
    await tenantQuery(
      req.tenant.slug,
      `UPDATE members SET pin = $1, updated_at = NOW() WHERE id = $2`,
      [pin, id],
    )
    res.json({ ok: true, pin })
  } catch (err) {
    console.error('[members/:id/reset-pin]', err)
    res.status(500).json({ error: 'Failed to reset PIN.' })
  }
})

// ─── GET /api/members/:id/checkins ──────────────────────────────────────────
// Check-in history for a specific member

membersRouter.get('/:id/checkins', async (req, res) => {
  try {
    const { id } = req.params
    const { page = '1', limit = '50' } = req.query as Record<string, string>
    const offset = (parseInt(page) - 1) * parseInt(limit)

    const { rows } = await tenantQuery(
      req.tenant.slug,
      `SELECT ci.id, ci.method, ci.staff_id, ci.checked_in_at
       FROM check_ins ci
       WHERE ci.member_id = $1
       ORDER BY ci.checked_in_at DESC
       LIMIT $2 OFFSET $3`,
      [id, parseInt(limit), offset],
    )
    return res.json({ checkins: rows })
  } catch (err) {
    console.error('[members/:id/checkins]', err)
    return res.status(500).json({ error: 'Failed to load check-in history.' })
  }
})

// ─── GET /api/members/:id/subscriptions ─────────────────────────────────────
// Subscription history for a specific member

membersRouter.get('/:id/subscriptions', async (req, res) => {
  try {
    const { id } = req.params
    const { rows } = await tenantQuery(
      req.tenant.slug,
      `SELECT s.*, mp.name as plan_name, mp.price, mp.duration_days
       FROM subscriptions s
       JOIN membership_plans mp ON mp.id = s.plan_id
       WHERE s.member_id = $1
       ORDER BY s.created_at DESC`,
      [id],
    )
    return res.json({ subscriptions: rows })
  } catch (err) {
    console.error('[members/:id/subscriptions]', err)
    return res.status(500).json({ error: 'Failed to load subscriptions.' })
  }
})

// ─── GET /api/members/:id/subscription-events ────────────────────────────────
// Full audit trail for all subscriptions belonging to a member

membersRouter.get('/:id/subscription-events', async (req, res) => {
  try {
    const { id } = req.params
    const { rows } = await tenantQuery(
      req.tenant.slug,
      `SELECT se.*, s.name as actor_name
       FROM subscription_events se
       LEFT JOIN staff s ON s.id = se.actor
       WHERE se.member_id = $1
       ORDER BY se.created_at DESC
       LIMIT 200`,
      [id],
    )
    res.json({ events: rows })
  } catch (err) {
    console.error('[members/:id/subscription-events]', err)
    res.status(500).json({ error: 'Failed to load activity.' })
  }
})

// ─── GET /api/members/:id/wallet ─────────────────────────────────────────────
// Wallet balance + recent transactions for a specific member (admin view)

membersRouter.get('/:id/wallet', async (req, res) => {
  try {
    const { id } = req.params
    const { rows: walletRows } = await tenantQuery<{ balance: string; currency: string }>(
      req.tenant.slug,
      `SELECT balance, currency FROM wallet_accounts WHERE member_id = $1`,
      [id],
    )
    const { rows: txRows } = await tenantQuery<{
      id: string; type: string; amount: string; description: string; status: string; created_at: string
    }>(
      req.tenant.slug,
      `SELECT id, type, amount, description, status, created_at
       FROM wallet_transactions WHERE member_id = $1
       ORDER BY created_at DESC LIMIT 30`,
      [id],
    )
    return res.json({
      balance: parseFloat(walletRows[0]?.balance ?? '0'),
      currency: walletRows[0]?.currency ?? 'XAF',
      transactions: txRows.map(t => ({ ...t, amount: parseFloat(t.amount) })),
    })
  } catch (err) {
    console.error('[members/:id/wallet]', err)
    return res.status(500).json({ error: 'Failed to load wallet.' })
  }
})

// ─── GET /api/members/export ─────────────────────────────────────────────────
// Export all members as CSV

membersRouter.get('/export', async (req, res) => {
  try {
    const { rows } = await tenantQuery(
      req.tenant.slug,
      `SELECT m.name, m.email, m.phone, m.status, m.qr_code, m.notes, m.joined_at,
              mp.name as plan_name, s.status as sub_status, s.expires_at
       FROM members m
       LEFT JOIN LATERAL (
         SELECT s2.status, s2.expires_at, s2.plan_id FROM subscriptions s2
         WHERE s2.member_id = m.id ORDER BY s2.created_at DESC LIMIT 1
       ) s ON true
       LEFT JOIN membership_plans mp ON mp.id = s.plan_id
       ORDER BY m.created_at DESC`,
    )

    const header = 'Name,Email,Phone,Status,QR Code,Plan,Subscription Status,Expires At,Joined At,Notes'
    const csvRows = (rows as Array<Record<string, unknown>>).map(r =>
      [r.name, r.email, r.phone ?? '', r.status, r.qr_code, r.plan_name ?? '', r.sub_status ?? '', r.expires_at ?? '', r.joined_at, r.notes ?? '']
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    )
    const csv = [header, ...csvRows].join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename=members.csv')
    return res.send(csv)
  } catch (err) {
    console.error('[members/export]', err)
    return res.status(500).json({ error: 'Failed to export members.' })
  }
})

// ─── POST /api/members/import ───────────────────────────────────────────────
// Bulk import members from JSON array.
// Each entry may optionally include subscription data (plan_name, started_at, expires_at).
// Returns: imported count, skipped emails, subscriptions created.

membersRouter.post('/import', validate(importMembersSchema), async (req, res) => {
  try {
    const { members } = req.body as {
      members: Array<{
        name: string; email: string; phone?: string; notes?: string
        plan_name?: string; started_at?: string; expires_at?: string
      }>
    }

    const slug = req.tenant.slug

    // ── Pre-load all plans for name matching ──────────────────────────────
    const { rows: planRows } = await tenantQuery<{ id: string; name: string; duration_days: number }>(
      slug,
      `SELECT id, name, duration_days FROM membership_plans WHERE is_active = TRUE`,
    )
    const plansByName = new Map(planRows.map(p => [p.name.toLowerCase().trim(), p]))

    // ── Fetch existing emails to identify skips ───────────────────────────
    const emailsToCheck = members
      .filter(m => m.name?.trim() && m.email?.trim())
      .map(m => m.email.toLowerCase().trim())

    let existingEmails = new Set<string>()
    if (emailsToCheck.length) {
      const placeholders = emailsToCheck.map((_, i) => `$${i + 1}`).join(',')
      const { rows: existingRows } = await tenantQuery<{ email: string }>(
        slug,
        `SELECT email FROM members WHERE email IN (${placeholders})`,
        emailsToCheck,
      )
      existingEmails = new Set(existingRows.map(r => r.email))
    }

    // ── Build insert batch ────────────────────────────────────────────────
    const params: unknown[] = []
    const valueGroups: string[] = []
    const newMembers: Array<{ id: string; name: string; email: string; qrCode: string; plan_name?: string; started_at?: string; expires_at?: string }> = []
    const skippedEmails: string[] = []

    for (const m of members) {
      if (!m.name?.trim() || !m.email?.trim()) continue
      const email = m.email.toLowerCase().trim()
      if (existingEmails.has(email)) { skippedEmails.push(email); continue }
      const id = uuid()
      const qrCode = `myfiti-${id.slice(0, 8).toUpperCase()}`
      const base = params.length
      params.push(id, m.name.trim(), email, m.phone?.trim() ?? null, qrCode, m.notes?.trim() ?? null)
      valueGroups.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, 'active', $${base + 5}, $${base + 6}, NOW(), NOW(), NOW())`)
      newMembers.push({ id, name: m.name.trim(), email, qrCode, plan_name: m.plan_name, started_at: m.started_at, expires_at: m.expires_at })
    }

    if (!valueGroups.length && !skippedEmails.length) {
      return res.status(400).json({ error: 'No valid members to import.' })
    }

    let subsCreated = 0

    if (valueGroups.length) {
      await tenantQuery(
        slug,
        `INSERT INTO members (id, name, email, phone, status, qr_code, notes, joined_at, created_at, updated_at)
         VALUES ${valueGroups.join(', ')}`,
        params,
      )

      // ── Create subscriptions where plan name matched ──────────────────
      for (const m of newMembers) {
        const plan = m.plan_name ? plansByName.get(m.plan_name.toLowerCase().trim()) : null
        if (plan) {
          const subId = uuid()
          const startedAt = m.started_at ? new Date(m.started_at) : new Date()
          const expiresAt = m.expires_at
            ? new Date(m.expires_at)
            : new Date(startedAt.getTime() + plan.duration_days * 86400000)

          await tenantQuery(
            slug,
            `INSERT INTO subscriptions (id, member_id, plan_id, status, started_at, expires_at, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
             ON CONFLICT DO NOTHING`,
            [subId, m.id, plan.id, expiresAt > new Date() ? 'active' : 'expired', startedAt.toISOString(), expiresAt.toISOString()],
          )
          subsCreated++
        }

        // Send welcome email — best-effort
        const matchedPlan = m.plan_name ? plansByName.get(m.plan_name.toLowerCase().trim()) : null
        sendMemberWelcomeEmail(
          { email: m.email, name: m.name },
          req.tenant.name,
          m.qrCode,
          matchedPlan ? m.plan_name : null,
          matchedPlan && m.expires_at ? m.expires_at : null,
        ).catch(err => console.warn('[members/import] welcome email failed for', m.email, err))
      }
    }

    return res.status(201).json({
      ok: true,
      imported: newMembers.length,
      skipped: skippedEmails.length,
      skippedEmails,
      subscriptionsCreated: subsCreated,
    })
  } catch (err) {
    console.error('[members/import]', err)
    return res.status(500).json({ error: 'Failed to import members.' })
  }
})

// ─── POST /api/members/with-payment ───────────────────────────────────────────
// Create member with payment processing (payment-first flow).
// Returns payment details and requires /confirm-payment after payment succeeds.

membersRouter.post('/with-payment', validate(createMemberSchema), async (req, res) => {
  try {
    const { name, email, phone, notes, referredByCode } = req.body
    const { payment_method, plan_id, phone_for_payment } = req.body as {
      payment_method?: string
      plan_id?: string
      phone_for_payment?: string
    }

    const id = uuid()
    const qrCode = `myfiti-${id.slice(0, 8).toUpperCase()}`
    const [pin, referralCode] = await Promise.all([
      generateUniquePin(req.tenant.slug),
      uniqueReferralCode(req.tenant.slug, name),
    ])

    // Resolve referrer
    let referredById: string | null = null
    if (referredByCode?.trim()) {
      const { rows: refRows } = await tenantQuery<{ id: string }>(
        req.tenant.slug,
        `SELECT id FROM members WHERE referral_code = $1 LIMIT 1`,
        [referredByCode.trim().toUpperCase()],
      )
      referredById = refRows[0]?.id ?? null
    }

    // Fetch plan price if provided
    let planPrice = 0
    if (plan_id) {
      const { rows: planRows } = await tenantQuery<{ price: string }>(
        req.tenant.slug,
        `SELECT price FROM membership_plans WHERE id = $1 LIMIT 1`,
        [plan_id],
      )
      planPrice = parseFloat(planRows[0]?.price ?? '0')
    }

    // Validate payment method
    const method = payment_method?.toLowerCase() || 'momo'
    const validMethods = ['momo', 'cash', 'bank_transfer']
    if (!validMethods.includes(method)) {
      return res.status(400).json({ error: `Invalid payment method. Choose: ${validMethods.join(', ')}` })
    }

    // Create member with pending_payment status
    const paymentRef = uuid()
    await tenantQuery(
      req.tenant.slug,
      `INSERT INTO members
        (id, name, email, phone, status, qr_code, pin, referral_code, referred_by_id, notes,
         payment_status, payment_method, payment_ref, joined_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'inactive', $5, $6, $7, $8, $9, 'pending_payment', $10, $11, NOW(), NOW(), NOW())`,
      [id, name.trim(), email.toLowerCase().trim(), phone?.trim() ?? null, qrCode, pin, referralCode,
       referredById, notes?.trim() ?? null, method, paymentRef],
    )

    // Create referral record if referred
    if (referredById) {
      await tenantQuery(
        req.tenant.slug,
        `INSERT INTO referrals (id, referrer_id, referred_id, status, created_at)
         VALUES ($1, $2, $3, 'pending', NOW())`,
        [uuid(), referredById, id],
      )
    }

    // Return payment details based on method
    const response: Record<string, unknown> = {
      ok: true,
      id,
      qrCode,
      pin,
      payment_method: method,
      payment_ref: paymentRef,
      requires_confirmation: ['cash', 'bank_transfer'].includes(method),
      plan_price: planPrice,
    }

    if (method === 'momo') {
      if (!phone_for_payment?.trim()) {
        // Delete the member if no phone provided
        await tenantQuery(req.tenant.slug, `DELETE FROM members WHERE id = $1`, [id]).catch(() => {})
        return res.status(400).json({ error: 'Phone number required for Momo payment.' })
      }
      response.message = `USSD request will be sent to ${phone_for_payment}. Wait for payment confirmation.`
    } else if (method === 'cash') {
      response.message = `Payment marked as pending. Admin will confirm receipt and activate member.`
    } else if (method === 'bank_transfer') {
      response.message = `Bank transfer pending. Admin will confirm and activate member once payment is received.`
    }

    return res.status(201).json(response)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return res.status(409).json({ error: 'A member with this email already exists.' })
    }
    console.error('[members/with-payment]', err)
    return res.status(500).json({ error: 'Failed to create member.' })
  }
})

// ─── POST /api/members/:id/confirm-payment ────────────────────────────────────
// Confirm payment and activate member. Called after payment succeeds or admin approves.

membersRouter.post('/:id/confirm-payment', async (req, res) => {
  try {
    const { id } = req.params

    // Get member
    const { rows: memberRows } = await tenantQuery<{
      id: string; status: string; payment_status: string; name: string; email: string; qr_code: string; pin: string
    }>(
      req.tenant.slug,
      `SELECT id, status, payment_status, name, email, qr_code, pin FROM members WHERE id = $1 LIMIT 1`,
      [id],
    )
    const member = memberRows[0]
    if (!member) return res.status(404).json({ error: 'Member not found.' })
    if (member.status === 'active') return res.status(400).json({ error: 'Member already active.' })

    // Update member to active status
    await tenantQuery(
      req.tenant.slug,
      `UPDATE members SET status = 'active', payment_status = 'completed', updated_at = NOW()
       WHERE id = $1`,
      [id],
    )

    // Send welcome email
    sendMemberWelcomeEmail(
      { email: member.email, name: member.name },
      req.tenant.name,
      member.qr_code,
      undefined,
      undefined,
      member.pin,
    ).catch(err => console.warn('[members/confirm-payment] welcome email failed:', err))

    return res.json({ ok: true, message: 'Member activated successfully.' })
  } catch (err) {
    console.error('[members/confirm-payment]', err)
    return res.status(500).json({ error: 'Failed to confirm payment.' })
  }
})

// ─── POST /api/members/:id/email ──────────────────────────────────────────────
// Send an email to a specific member

membersRouter.post('/:id/email', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const { subject, body } = req.body as { subject?: string; body?: string }
    if (!subject?.trim() || !body?.trim()) {
      return res.status(400).json({ error: 'Subject and body are required.' })
    }
    const { rows } = await tenantQuery(
      req.tenant.slug,
      `SELECT id, name, email FROM members WHERE id = $1 LIMIT 1`,
      [req.params.id],
    )
    const member = rows[0] as { id: string; name: string; email: string } | undefined
    if (!member) return res.status(404).json({ error: 'Member not found.' })

    await sendAnnouncementEmail(
      { email: member.email, name: member.name },
      subject.trim(),
      body.trim(),
      req.tenant.name,
    )
    return res.json({ ok: true })
  } catch (err) {
    console.error('[members/:id/email]', err)
    return res.status(500).json({ error: 'Failed to send email.' })
  }
})
