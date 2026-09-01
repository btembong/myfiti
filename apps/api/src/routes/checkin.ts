import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { tenantQuery } from '../db/client.js'
import { addKioskClient, broadcastCheckin } from '../lib/kiosk-events.js'

// ─── Time-slot helper ─────────────────────────────────────────────────────────

function isInTimeSlot(startTime: string, endTime: string, tz: string): boolean {
  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false, timeZone: tz, hour: '2-digit', minute: '2-digit' })
  const [ch, cm] = timeStr.split(':').map(Number)
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const cur   = ch * 60 + cm
  const start = sh * 60 + sm
  const end   = eh * 60 + em
  // Supports windows that cross midnight (e.g. 22:00–06:00)
  return end >= start ? cur >= start && cur < end : cur >= start || cur < end
}

export const checkinRouter = Router()

// ─── POST /api/checkin/verify-qr ─────────────────────────────────────────────
// Kiosk endpoint — validates a member's QR JWT and records check-in
// No auth required (kiosk runs unauthenticated)

checkinRouter.post('/verify-qr', async (req, res) => {
  try {
    const { token: qrToken } = req.body
    if (!qrToken) return res.status(400).json({ error: 'QR token required.' })

    // Try JWT first (mobile-app dynamic QR), fall back to plain qr_code string (printed card)
    let memberId: string
    try {
      const payload = jwt.verify(qrToken, process.env.JWT_SECRET!) as { sub: string; type: string; exp: number }
      if (payload.type !== 'checkin') {
        return res.status(400).json({ ok: false, reason: 'wrong_type', message: 'Not a check-in QR code.' })
      }
      memberId = payload.sub
    } catch {
      // Not a valid JWT — treat as plain qr_code string (e.g. "myfiti-A3B8F2C1")
      const { rows: qrRows } = await tenantQuery<{ id: string }>(
        req.tenant.slug,
        `SELECT id FROM members WHERE qr_code = $1 AND status != 'inactive' LIMIT 1`,
        [qrToken],
      )
      if (!qrRows[0]) {
        return res.status(401).json({ ok: false, reason: 'invalid_qr', message: 'QR code not recognised.' })
      }
      memberId = qrRows[0].id
    }

    const { rows } = await tenantQuery(
      req.tenant.slug,
      `SELECT m.*, s.status as sub_status, s.expires_at,
              mp.access_type, mp.access_start_time::text as access_start_time, mp.access_end_time::text as access_end_time,
              COALESCE(gs.timezone, 'Africa/Douala') as gym_timezone
       FROM members m
       LEFT JOIN LATERAL (
         SELECT status, expires_at, plan_id FROM subscriptions
         WHERE member_id = m.id
         ORDER BY created_at DESC LIMIT 1
       ) s ON TRUE
       LEFT JOIN membership_plans mp ON mp.id = s.plan_id
       CROSS JOIN (SELECT COALESCE(timezone, 'Africa/Douala') as timezone FROM gym_settings WHERE id = 'singleton' LIMIT 1) gs
       WHERE m.id = $1
       LIMIT 1`,
      [memberId],
    )

    const result = rows[0] as Record<string, unknown> | undefined
    if (!result) {
      return res.json({ ok: false, reason: 'not_found', message: 'Member not found.' })
    }

    if (result.sub_status === 'suspended' || result.sub_status === 'cancelled') {
      return res.json({
        ok: false,
        reason: 'suspended',
        member: { name: result.name, avatar_url: result.avatar_url },
        message: 'Membership suspended.',
      })
    }

    // Check time-slot restriction if plan has one
    if (result.access_type === 'time_slot' && result.access_start_time && result.access_end_time) {
      const allowed = isInTimeSlot(
        result.access_start_time as string,
        result.access_end_time as string,
        result.gym_timezone as string,
      )
      if (!allowed) {
        return res.json({
          ok: false,
          reason: 'outside_hours',
          member: { name: result.name, avatar_url: result.avatar_url },
          message: `Access is only allowed between ${result.access_start_time} and ${result.access_end_time}.`,
        })
      }
    }

    // Record check-in
    const checkinId = uuid()
    await tenantQuery(
      req.tenant.slug,
      `INSERT INTO check_ins (id, member_id, method, checked_in_at)
       VALUES ($1, $2, 'qr', NOW())`,
      [checkinId, memberId],
    )

    const member = {
      id: result.id,
      name: result.name,
      avatar_url: result.avatar_url,
      status: result.sub_status ?? result.status,
      expires_at: result.expires_at,
    }
    broadcastCheckin(req.tenant.slug, { type: 'checkin', method: 'qr', member })
    res.json({ ok: true, member })
  } catch (err) {
    console.error('[checkin/verify-qr]', err)
    res.status(500).json({ error: 'Check-in failed.' })
  }
})

// ─── POST /api/checkin/lookup ────────────────────────────────────────────────
// Kiosk/reception: look up a member by phone or name for manual check-in

checkinRouter.post('/lookup', async (req, res) => {
  try {
    const { query } = req.body as { query: string }
    if (!query?.trim()) return res.status(400).json({ error: 'query is required.' })

    const q = `%${query.trim()}%`
    const { rows } = await tenantQuery(
      req.tenant.slug,
      `SELECT m.id, m.name, m.phone, m.email, m.avatar_url, m.status, m.qr_code,
              s.status as sub_status, s.expires_at
       FROM members m
       LEFT JOIN LATERAL (
         SELECT status, expires_at FROM subscriptions
         WHERE member_id = m.id ORDER BY created_at DESC LIMIT 1
       ) s ON TRUE
       WHERE m.status != 'inactive'
         AND (m.name ILIKE $1 OR m.phone ILIKE $1 OR m.email ILIKE $1)
       ORDER BY m.name ASC
       LIMIT 10`,
      [q],
    )

    res.json({ members: rows })
  } catch (err) {
    console.error('[checkin/lookup]', err)
    res.status(500).json({ error: 'Lookup failed.' })
  }
})

// ─── POST /api/checkin/daypass ──────────────────────────────────────────────
// Record a check-in entry for a day-pass visitor (kiosk use)

checkinRouter.post('/daypass', async (req, res) => {
  try {
    const { day_pass_id, guest_name } = req.body as { day_pass_id: string; guest_name?: string }
    if (!day_pass_id) return res.status(400).json({ error: 'day_pass_id is required.' })

    // Verify the day pass exists and is active
    const { rows } = await tenantQuery<{ status: string; guest_name: string }>(
      req.tenant.slug,
      `SELECT status, guest_name FROM day_passes WHERE id = $1 LIMIT 1`,
      [day_pass_id],
    )
    const pass = rows[0]
    if (!pass) return res.status(404).json({ error: 'Day pass not found.' })
    if (pass.status !== 'active') {
      return res.status(400).json({ error: `Day pass is ${pass.status}.` })
    }

    // Mark as used + record check-in
    const checkinId = uuid()
    await Promise.all([
      tenantQuery(
        req.tenant.slug,
        `UPDATE day_passes SET status = 'used', checked_in_at = NOW() WHERE id = $1`,
        [day_pass_id],
      ),
      tenantQuery(
        req.tenant.slug,
        `INSERT INTO check_ins (id, member_id, method, notes, checked_in_at)
         VALUES ($1, NULL, 'daypass', $2, NOW())`,
        [checkinId, `Day pass: ${guest_name ?? pass.guest_name}`],
      ),
    ])

    res.json({ ok: true, checkin_id: checkinId, guest_name: pass.guest_name })
  } catch (err) {
    console.error('[checkin/daypass]', err)
    res.status(500).json({ error: 'Failed to record day pass check-in.' })
  }
})

// ─── POST /api/checkin/verify-pin ────────────────────────────────────────────
// Kiosk endpoint — validates a member's 4-digit PIN and records check-in
// No auth required (kiosk runs unauthenticated)

checkinRouter.post('/verify-pin', async (req, res) => {
  try {
    const { pin } = req.body
    if (!pin || !/^\d{4}$/.test(String(pin))) {
      return res.status(400).json({ ok: false, reason: 'invalid_pin', message: 'PIN must be exactly 4 digits.' })
    }

    const { rows } = await tenantQuery(
      req.tenant.slug,
      `SELECT m.*, s.status as sub_status, s.expires_at,
              mp.access_type, mp.access_start_time::text as access_start_time, mp.access_end_time::text as access_end_time,
              COALESCE(gs.timezone, 'Africa/Douala') as gym_timezone
       FROM members m
       LEFT JOIN LATERAL (
         SELECT status, expires_at, plan_id FROM subscriptions
         WHERE member_id = m.id
         ORDER BY created_at DESC LIMIT 1
       ) s ON TRUE
       LEFT JOIN membership_plans mp ON mp.id = s.plan_id
       CROSS JOIN (SELECT COALESCE(timezone, 'Africa/Douala') as timezone FROM gym_settings WHERE id = 'singleton' LIMIT 1) gs
       WHERE m.pin = $1 AND m.status != 'inactive'
       LIMIT 1`,
      [String(pin)],
    )

    const result = rows[0] as Record<string, unknown> | undefined
    if (!result) {
      return res.json({ ok: false, reason: 'not_found', message: 'No member found with that PIN.' })
    }

    if (result.status === 'suspended') {
      return res.json({
        ok: false, reason: 'suspended',
        member: { name: result.name, avatar_url: result.avatar_url },
        message: 'Membership suspended.',
      })
    }

    if (result.sub_status === 'cancelled') {
      return res.json({
        ok: false, reason: 'cancelled',
        member: { name: result.name, avatar_url: result.avatar_url },
        message: 'Membership cancelled.',
      })
    }

    // Check time-slot restriction if plan has one
    if (result.access_type === 'time_slot' && result.access_start_time && result.access_end_time) {
      const allowed = isInTimeSlot(
        result.access_start_time as string,
        result.access_end_time as string,
        result.gym_timezone as string,
      )
      if (!allowed) {
        return res.json({
          ok: false,
          reason: 'outside_hours',
          member: { name: result.name, avatar_url: result.avatar_url },
          message: `Access is only allowed between ${result.access_start_time} and ${result.access_end_time}.`,
        })
      }
    }

    const checkinId = uuid()
    await tenantQuery(
      req.tenant.slug,
      `INSERT INTO check_ins (id, member_id, method, checked_in_at) VALUES ($1, $2, 'pin', NOW())`,
      [checkinId, result.id],
    )

    const member = {
      id: result.id,
      name: result.name,
      avatar_url: result.avatar_url,
      status: result.sub_status ?? result.status,
      expires_at: result.expires_at,
    }
    broadcastCheckin(req.tenant.slug, { type: 'checkin', method: 'pin', member })
    res.json({ ok: true, member })
  } catch (err) {
    console.error('[checkin/verify-pin]', err)
    res.status(500).json({ error: 'Check-in failed.' })
  }
})

// ─── GET /api/checkin/events ──────────────────────────────────────────────────
// SSE stream — kiosk subscribes here to receive real-time check-in events.
// Uses ?slug= query param because EventSource cannot send custom headers.

checkinRouter.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // disable nginx buffering if behind proxy
  res.flushHeaders()

  const cleanup = addKioskClient(req.tenant.slug, res)
  const ping = setInterval(() => { try { res.write(': ping\n\n') } catch { cleanup() } }, 25000)

  req.on('close', () => { cleanup(); clearInterval(ping) })
})

// ─── GET /api/checkin/live ────────────────────────────────────────────────────
// Live stats: today's count, current occupancy, recent 10
// Public — kiosk uses this without auth (tenant resolved via X-Tenant-Slug header)

checkinRouter.get('/live', async (req, res) => {
  try {
    const [statsResult, recentResult, passResult, revenueResult] = await Promise.all([
      tenantQuery(
        req.tenant.slug,
        `SELECT
           COUNT(*) FILTER (WHERE checked_in_at >= CURRENT_DATE) as today,
           COUNT(*) FILTER (WHERE checked_in_at >= NOW() - INTERVAL '1 hour') as last_hour,
           COUNT(*) FILTER (WHERE checked_in_at >= NOW() - INTERVAL '7 days') as last_7d
         FROM check_ins`,
      ),
      tenantQuery(
        req.tenant.slug,
        `SELECT ci.id,
                COALESCE(
                  m.name,
                  CASE WHEN ci.notes LIKE 'Day pass: %' THEN substring(ci.notes FROM 11) ELSE ci.notes END,
                  'Guest'
                ) as name,
                m.avatar_url, ci.method, ci.checked_in_at, ci.staff_id,
                mp.name as plan_name, mp.expires_at,
                CASE WHEN ci.method = 'daypass' THEN FALSE
                     ELSE NOT EXISTS (
                       SELECT 1 FROM check_ins ci2
                       WHERE ci2.member_id = ci.member_id
                         AND ci2.member_id IS NOT NULL
                         AND ci2.checked_in_at < ci.checked_in_at
                         AND ci2.checked_in_at >= CURRENT_DATE
                     )
                END as is_first_today
         FROM check_ins ci
         LEFT JOIN members m ON m.id = ci.member_id
         LEFT JOIN LATERAL (
           SELECT mp2.name, s.expires_at FROM subscriptions s
           JOIN membership_plans mp2 ON mp2.id = s.plan_id
           WHERE s.member_id = ci.member_id AND ci.member_id IS NOT NULL
           ORDER BY s.created_at DESC LIMIT 1
         ) mp ON TRUE
         ORDER BY ci.checked_in_at DESC
         LIMIT 100`,
      ),
      tenantQuery(
        req.tenant.slug,
        `SELECT COUNT(*) as day_passes_today, COALESCE(SUM(amount),0) as dp_revenue_today
         FROM day_passes WHERE created_at >= CURRENT_DATE AND status IN ('active','used')`,
      ),
      tenantQuery(
        req.tenant.slug,
        `SELECT COALESCE(SUM(amount),0) as sub_revenue_today
         FROM payments WHERE paid_at >= CURRENT_DATE AND status IN ('paid','completed')`,
      ),
    ])

    const stats = statsResult.rows[0] as Record<string, unknown>
    const pr = passResult.rows[0] as { day_passes_today: string; dp_revenue_today: string }
    const rr = revenueResult.rows[0] as { sub_revenue_today: string }
    const revenueToday = parseFloat(pr.dp_revenue_today ?? '0') + parseFloat(rr.sub_revenue_today ?? '0')

    res.json({
      stats: {
        ...stats,
        day_passes_today: pr.day_passes_today ?? '0',
        revenue_today: revenueToday,
      },
      recent: recentResult.rows,
    })
  } catch (err) {
    console.error('[checkin/live]', err)
    res.status(500).json({ error: 'Failed to load live stats.' })
  }
})

// ─── POST /api/checkin/manual ─────────────────────────────────────────────────
// Kiosk manual check-in: record a check-in by member_id (no auth required)
// Used after staff searches for a member and selects them at the kiosk.

checkinRouter.post('/manual', async (req, res) => {
  try {
    const { member_id, staff_id } = req.body as { member_id: string; staff_id?: string }
    if (!member_id) return res.status(400).json({ error: 'member_id is required.' })

    // Verify member exists and is active
    const { rows } = await tenantQuery<{ id: string; status: string }>(
      req.tenant.slug,
      `SELECT id, status FROM members WHERE id = $1 AND status != 'inactive' LIMIT 1`,
      [member_id],
    )
    if (!rows[0]) return res.status(404).json({ ok: false, reason: 'not_found' })

    const id = uuid()
    const { rows: mRows } = await tenantQuery<{ name: string; avatar_url: string | null }>(
      req.tenant.slug,
      `SELECT name, avatar_url FROM members WHERE id = $1 LIMIT 1`,
      [member_id],
    )
    await tenantQuery(
      req.tenant.slug,
      `INSERT INTO check_ins (id, member_id, method, staff_id, checked_in_at) VALUES ($1, $2, 'manual', $3, NOW())`,
      [id, member_id, staff_id ?? null],
    )
    if (mRows[0]) broadcastCheckin(req.tenant.slug, { type: 'checkin', method: 'manual', member: { id: member_id, ...mRows[0] } })
    res.json({ ok: true, id })
  } catch (err) {
    console.error('[checkin/manual]', err)
    res.status(500).json({ error: 'Failed to record check-in.' })
  }
})

// ─── POST /api/checkin/staff-verify-pin ──────────────────────────────────────
// Kiosk endpoint: validate a staff member's 4-digit PIN to unlock staff mode.
// Uses checkinRouter (not authRouter) so tenant middleware runs and req.tenant is set.

checkinRouter.post('/staff-verify-pin', async (req, res) => {
  try {
    const { pin } = req.body
    if (!pin || !/^\d{4}$/.test(String(pin))) {
      return res.status(400).json({ ok: false, message: 'PIN must be 4 digits.' })
    }

    const { rows } = await tenantQuery<{ id: string; name: string; role: string; pin_hash: string }>(
      req.tenant.slug,
      `SELECT id, name, role, pin_hash FROM staff WHERE pin_hash IS NOT NULL AND is_active = TRUE`,
    )

    for (const staff of rows) {
      const match = await bcrypt.compare(String(pin), staff.pin_hash)
      if (match) {
        return res.json({ ok: true, staff: { id: staff.id, name: staff.name, role: staff.role } })
      }
    }

    return res.json({ ok: false, message: 'Incorrect PIN.' })
  } catch (err) {
    console.error('[checkin/staff-verify-pin]', err)
    res.status(500).json({ ok: false, message: 'Server error.' })
  }
})

// ─── DELETE /api/checkin/undo-last ───────────────────────────────────────────
// Kiosk staff: delete the most recent check-in recorded within the last 5 minutes.
// Safety window prevents accidental deletion of old records.

checkinRouter.delete('/undo-last', async (req, res) => {
  try {
    const { rows } = await tenantQuery<{ id: string; member_id: string | null }>(
      req.tenant.slug,
      `SELECT id, member_id FROM check_ins
       WHERE checked_in_at >= NOW() - INTERVAL '5 minutes'
       ORDER BY checked_in_at DESC LIMIT 1`,
    )
    const last = rows[0]
    if (!last) return res.status(404).json({ ok: false, message: 'No recent check-in to undo (must be within 5 minutes).' })

    await tenantQuery(req.tenant.slug, `DELETE FROM check_ins WHERE id = $1`, [last.id])
    res.json({ ok: true, deleted_id: last.id })
  } catch (err) {
    console.error('[checkin/undo-last]', err)
    res.status(500).json({ error: 'Failed to undo check-in.' })
  }
})

// ─── GET /api/checkin/qr-url ──────────────────────────────────────────────────
// Generate a signed kiosk QR URL — no auth required (kiosk fetches this on load)

checkinRouter.get('/qr-url', async (req, res) => {
  try {
    const token = jwt.sign(
      { type: 'kiosk', tenant: req.tenant.slug },
      process.env.JWT_SECRET!,
      { expiresIn: '365d' },
    )
    const url = `${process.env.APP_URL ?? 'https://app.myfiti.com'}/kiosk?t=${token}`
    res.json({ url, token })
  } catch (err) {
    console.error('[checkin/qr-url]', err)
    res.status(500).json({ error: 'Failed to generate QR URL.' })
  }
})

// All routes below require auth + staff role
checkinRouter.use(requireAuth)
checkinRouter.use(requireRole('owner', 'admin', 'receptionist', 'trainer'))

// ─── POST /api/checkin ────────────────────────────────────────────────────────
// Manual check-in (staff records by member ID)

checkinRouter.post('/', async (req, res) => {
  try {
    const { member_id, method = 'manual', staff_id } = req.body
    if (!member_id) return res.status(400).json({ error: 'member_id is required.' })

    const id = uuid()
    await tenantQuery(
      req.tenant.slug,
      `INSERT INTO check_ins (id, member_id, method, staff_id, checked_in_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [id, member_id, method, staff_id ?? null],
    )
    res.status(201).json({ id, ok: true })
  } catch (err) {
    console.error('[checkin POST]', err)
    res.status(500).json({ error: 'Failed to record check-in.' })
  }
})

// ─── GET /api/checkin ─────────────────────────────────────────────────────────
// List check-ins with date/member filters

checkinRouter.get('/', async (req, res) => {
  try {
    const { member_id, from, to, page = '1', limit = '50' } = req.query as Record<string, string>
    const offset = (parseInt(page) - 1) * parseInt(limit)

    const params: unknown[] = []
    const conditions: string[] = []
    if (member_id) { params.push(member_id); conditions.push(`ci.member_id = $${params.length}`) }
    if (from) { params.push(from); conditions.push(`ci.checked_in_at >= $${params.length}`) }
    if (to) { params.push(to); conditions.push(`ci.checked_in_at <= $${params.length}`) }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    params.push(parseInt(limit))
    const limitIdx = params.length
    params.push(offset)
    const offsetIdx = params.length

    const { rows } = await tenantQuery(
      req.tenant.slug,
      `SELECT ci.*, m.name as member_name, m.email as member_email, m.avatar_url
       FROM check_ins ci
       JOIN members m ON m.id = ci.member_id
       ${where}
       ORDER BY ci.checked_in_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    )

    // Use same WHERE for count (without limit/offset params)
    const countParams = params.slice(0, params.length - 2)
    const { rows: totalRows } = await tenantQuery(
      req.tenant.slug,
      `SELECT COUNT(*) as count FROM check_ins ci ${where}`,
      countParams,
    )

    res.json({
      checkins: rows,
      total: parseInt((totalRows[0] as { count: string })?.count ?? '0'),
      page: parseInt(page),
      limit: parseInt(limit),
    })
  } catch (err) {
    console.error('[checkin GET]', err)
    res.status(500).json({ error: 'Failed to load check-ins.' })
  }
})


