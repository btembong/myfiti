import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { tenantQuery } from '../db/client.js'
import { validate } from '../middleware/validate.js'
import { createPlanSchema, updatePlanSchema } from '../schemas.js'
import { sendActivationInvoiceEmail } from '../lib/email.js'

// ─── Audit helper ─────────────────────────────────────────────────────────────

async function logSubEvent(
  tenantSlug: string,
  subscriptionId: string,
  memberId: string,
  eventType: string,
  details: Record<string, unknown>,
  actor: string,
) {
  try {
    await tenantQuery(
      tenantSlug,
      `INSERT INTO subscription_events (id, subscription_id, member_id, event_type, details, actor, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [uuid(), subscriptionId, memberId, eventType, JSON.stringify(details), actor],
    )
  } catch {
    // Non-fatal — never let logging break the main operation
  }
}

export const subscriptionsRouter = Router()

subscriptionsRouter.use(requireAuth)
subscriptionsRouter.use(requireRole('owner', 'admin', 'receptionist'))

// ─── PLANS ────────────────────────────────────────────────────────────────────

// GET /api/subscriptions/plans
subscriptionsRouter.get('/plans', async (req, res) => {
  try {
    const { rows } = await tenantQuery(
      req.tenant.slug,
      `SELECT p.*, COUNT(s.id) as subscriber_count
       FROM membership_plans p
       LEFT JOIN subscriptions s ON s.plan_id = p.id AND s.status IN ('active','expiring_soon','grace_period')
       GROUP BY p.id
       ORDER BY p.price ASC`,
    )
    res.json({ plans: rows })
  } catch (err) {
    console.error('[subscriptions/plans GET]', err)
    res.status(500).json({ error: 'Failed to load plans.' })
  }
})

// POST /api/subscriptions/plans
subscriptionsRouter.post('/plans', validate(createPlanSchema), async (req, res) => {
  try {
    const { name, description, price, duration_days, currency, features, access_type, access_start_time, access_end_time } = req.body
    const id = uuid()
    const aType = access_type ?? 'open'
    const aStart = aType === 'time_slot' ? (access_start_time ?? null) : null
    const aEnd   = aType === 'time_slot' ? (access_end_time   ?? null) : null
    await tenantQuery(
      req.tenant.slug,
      `INSERT INTO membership_plans (id, name, description, price, currency, duration_days, features, access_type, access_start_time, access_end_time, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, NOW())`,
      [id, name, description ?? null, parseFloat(price), currency ?? 'XAF', parseInt(duration_days), features ?? null, aType, aStart, aEnd],
    )
    res.status(201).json({ id, ok: true })
  } catch (err) {
    console.error('[subscriptions/plans POST]', err)
    res.status(500).json({ error: 'Failed to create plan.' })
  }
})

// PATCH /api/subscriptions/plans/:id
subscriptionsRouter.patch('/plans/:id', validate(updatePlanSchema), async (req, res) => {
  try {
    const { id } = req.params
    const fields = req.body as Record<string, unknown>
    const allowed = ['name', 'description', 'price', 'duration_days', 'features', 'is_active', 'access_type', 'access_start_time', 'access_end_time']

    const params: unknown[] = []
    const sets: string[] = []
    for (const [k, v] of Object.entries(fields)) {
      if (!allowed.includes(k)) continue
      params.push(v ?? null)
      sets.push(`${k} = $${params.length}`)
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update.' })

    params.push(id)
    await tenantQuery(
      req.tenant.slug,
      `UPDATE membership_plans SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params,
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[subscriptions/plans PATCH]', err)
    res.status(500).json({ error: 'Failed to update plan.' })
  }
})

// DELETE /api/subscriptions/plans/:id
subscriptionsRouter.delete('/plans/:id', async (req, res) => {
  try {
    const { id } = req.params
    await tenantQuery(
      req.tenant.slug,
      `UPDATE membership_plans SET is_active = FALSE WHERE id = $1`,
      [id],
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[subscriptions/plans DELETE]', err)
    res.status(500).json({ error: 'Failed to deactivate plan.' })
  }
})

// ─── SUBSCRIPTIONS ────────────────────────────────────────────────────────────

// GET /api/subscriptions?member_id=&status=&page=&limit=
subscriptionsRouter.get('/', async (req, res) => {
  try {
    const { member_id, status, page = '1', limit = '50' } = req.query as Record<string, string>
    const offset = (parseInt(page) - 1) * parseInt(limit)

    const params: unknown[] = []
    const conditions: string[] = []
    if (member_id) { params.push(member_id); conditions.push(`s.member_id = $${params.length}`) }
    if (status) { params.push(status); conditions.push(`s.status = $${params.length}`) }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const countParams = [...params]

    params.push(parseInt(limit))
    const limitIdx = params.length
    params.push(offset)
    const offsetIdx = params.length

    const [{ rows }, { rows: totalRows }] = await Promise.all([
      tenantQuery(
        req.tenant.slug,
        `SELECT s.*, mp.name as plan_name, mp.price, mp.duration_days,
                m.name as member_name, m.email as member_email, m.avatar_url
         FROM subscriptions s
         JOIN membership_plans mp ON mp.id = s.plan_id
         JOIN members m ON m.id = s.member_id
         ${where}
         ORDER BY s.created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params,
      ),
      tenantQuery(
        req.tenant.slug,
        `SELECT COUNT(*) as count FROM subscriptions s ${where}`,
        countParams,
      ),
    ])

    res.json({
      subscriptions: rows,
      total: parseInt((totalRows[0] as { count: string })?.count ?? '0'),
      page: parseInt(page),
      limit: parseInt(limit),
    })
  } catch (err) {
    console.error('[subscriptions GET]', err)
    res.status(500).json({ error: 'Failed to load subscriptions.' })
  }
})

// POST /api/subscriptions — create a new subscription for a member
subscriptionsRouter.post('/', async (req, res) => {
  try {
    const { member_id, plan_id, started_at } = req.body
    if (!member_id || !plan_id) {
      return res.status(400).json({ error: 'member_id and plan_id are required.' })
    }

    const id = uuid()

    // Get plan details
    const { rows: planRows } = await tenantQuery<{ duration_days: number; name: string; price: number }>(
      req.tenant.slug,
      `SELECT duration_days, name, price FROM membership_plans WHERE id = $1`,
      [plan_id],
    )
    const plan = planRows[0]
    if (!plan) return res.status(404).json({ error: 'Plan not found.' })

    const start = started_at ? new Date(started_at) : new Date()
    const expires = new Date(start.getTime() + plan.duration_days * 24 * 60 * 60 * 1000)
    const grace = new Date(expires.getTime() + 7 * 24 * 60 * 60 * 1000)

    await tenantQuery(
      req.tenant.slug,
      `INSERT INTO subscriptions (id, member_id, plan_id, status, started_at, expires_at, grace_expires_at, created_at)
       VALUES ($1, $2, $3, 'active', $4, $5, $6, NOW())`,
      [id, member_id, plan_id, start.toISOString(), expires.toISOString(), grace.toISOString()],
    )

    // Update member status
    await tenantQuery(
      req.tenant.slug,
      `UPDATE members SET status = 'active', updated_at = NOW() WHERE id = $1`,
      [member_id],
    )

    const actor = req.auth?.sub ?? 'staff'
    await logSubEvent(req.tenant.slug, id, member_id, 'plan_assigned', { plan_id, started_at: start.toISOString(), expires_at: expires.toISOString() }, actor)

    res.status(201).json({ id, ok: true })

    // Fire-and-forget: send PDF invoice to the member's email
    ;(async () => {
      try {
        const [{ rows: memberRows }, { rows: gymRows }] = await Promise.all([
          tenantQuery<{ name: string; email: string }>(
            req.tenant.slug,
            `SELECT name, email FROM members WHERE id = $1 LIMIT 1`,
            [member_id],
          ),
          tenantQuery<{ gym_name: string; primary_color: string | null; logo_url: string | null; currency: string }>(
            req.tenant.slug,
            `SELECT gym_name, primary_color, logo_url, currency FROM gym_settings WHERE id = 'singleton' LIMIT 1`,
          ),
        ])
        const member = memberRows[0]
        const gym    = gymRows[0]
        if (member?.email && gym) {
          await sendActivationInvoiceEmail(
            { email: member.email, name: member.name },
            gym,
            { id, plan_name: plan.name, price: Number(plan.price), started_at: start.toISOString(), expires_at: expires.toISOString() },
          )
        }
      } catch (err) {
        console.warn('[subscriptions POST] invoice email failed:', err)
      }
    })()
  } catch (err) {
    console.error('[subscriptions POST]', err)
    res.status(500).json({ error: 'Failed to create subscription.' })
  }
})

// GET /api/subscriptions/:id
subscriptionsRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { rows } = await tenantQuery(
      req.tenant.slug,
      `SELECT s.*, mp.name as plan_name, mp.price, mp.duration_days,
              m.name as member_name, m.email as member_email
       FROM subscriptions s
       JOIN membership_plans mp ON mp.id = s.plan_id
       JOIN members m ON m.id = s.member_id
       WHERE s.id = $1
       LIMIT 1`,
      [id],
    )
    if (!rows[0]) return res.status(404).json({ error: 'Subscription not found.' })
    res.json(rows[0])
  } catch (err) {
    console.error('[subscriptions/:id GET]', err)
    res.status(500).json({ error: 'Failed to load subscription.' })
  }
})

// PATCH /api/subscriptions/:id — cancel, suspend, extend, freeze, unfreeze
subscriptionsRouter.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { status, extends_days, auto_renew, freeze_days, unfreeze } = req.body
    const actor = req.auth?.sub ?? 'staff'

    // Fetch member_id once for audit logging
    const { rows: subRows } = await tenantQuery<{ member_id: string }>(
      req.tenant.slug,
      `SELECT member_id FROM subscriptions WHERE id = $1 LIMIT 1`,
      [id],
    )
    const memberId = subRows[0]?.member_id ?? ''

    if (auto_renew !== undefined) {
      await tenantQuery(
        req.tenant.slug,
        `UPDATE subscriptions SET auto_renew = $1, updated_at = NOW() WHERE id = $2`,
        [!!auto_renew, id],
      )
    }
    if (status) {
      const cancelledClause = status === 'cancelled' ? ', cancelled_at = NOW()' : ''
      await tenantQuery(
        req.tenant.slug,
        `UPDATE subscriptions SET status = $1${cancelledClause}, updated_at = NOW() WHERE id = $2`,
        [status, id],
      )
      await logSubEvent(req.tenant.slug, id, memberId, 'status_changed', { status }, actor)
    }
    if (extends_days) {
      const days = parseInt(extends_days)
      await tenantQuery(
        req.tenant.slug,
        `UPDATE subscriptions
         SET expires_at = expires_at + ($1 || ' days')::interval,
             grace_expires_at = grace_expires_at + ($1 || ' days')::interval,
             updated_at = NOW()
         WHERE id = $2`,
        [String(days), id],
      )
      await logSubEvent(req.tenant.slug, id, memberId, 'renewed', { extends_days: days }, actor)
    }
    if (freeze_days) {
      const days = parseInt(freeze_days)
      const frozenUntil = new Date(Date.now() + days * 86_400_000).toISOString()
      await tenantQuery(
        req.tenant.slug,
        `UPDATE subscriptions
         SET status = 'frozen',
             frozen_until = $1,
             expires_at = expires_at + ($2 || ' days')::interval,
             grace_expires_at = COALESCE(grace_expires_at, expires_at) + ($2 || ' days')::interval,
             updated_at = NOW()
         WHERE id = $3`,
        [frozenUntil, String(days), id],
      )
      await logSubEvent(req.tenant.slug, id, memberId, 'frozen', { days, frozen_until: frozenUntil }, actor)
    }
    if (unfreeze) {
      await tenantQuery(
        req.tenant.slug,
        `UPDATE subscriptions SET status = 'active', frozen_until = NULL, updated_at = NOW() WHERE id = $1`,
        [id],
      )
      await logSubEvent(req.tenant.slug, id, memberId, 'unfrozen', {}, actor)
    }
    res.json({ ok: true })
  } catch (err) {
    console.error('[subscriptions/:id PATCH]', err)
    res.status(500).json({ error: 'Failed to update subscription.' })
  }
})

// GET /api/subscriptions/:id/events — audit trail for one subscription
subscriptionsRouter.get('/:id/events', async (req, res) => {
  try {
    const { id } = req.params
    const { rows } = await tenantQuery(
      req.tenant.slug,
      `SELECT se.*, s.name as actor_name
       FROM subscription_events se
       LEFT JOIN staff s ON s.id = se.actor
       WHERE se.subscription_id = $1
       ORDER BY se.created_at DESC
       LIMIT 100`,
      [id],
    )
    res.json({ events: rows })
  } catch (err) {
    console.error('[subscriptions/:id/events GET]', err)
    res.status(500).json({ error: 'Failed to load events.' })
  }
})
