import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import jwt from 'jsonwebtoken'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { globalQuery, tenantQuery } from '../db/client.js'

export const memberMeRouter = Router()

memberMeRouter.use(requireAuth)
memberMeRouter.use(requireRole('member'))

// Extend auth payload type locally for member tokens
interface MemberAuth {
  sub: string
  role: 'member'
  tenant_id: string
  tenant_slug: string
  session_id?: string
}

// Silently update last_active_at for the current session on every request
memberMeRouter.use((req, _res, next) => {
  const auth = req.auth as unknown as MemberAuth
  if (auth?.session_id && auth?.tenant_slug) {
    tenantQuery(
      auth.tenant_slug,
      `UPDATE member_sessions SET last_active_at = NOW() WHERE id = $1`,
      [auth.session_id],
    ).catch(() => {})
  }
  next()
})

// ─── GET /api/member/me ───────────────────────────────────────────────────────

memberMeRouter.get('/', async (req, res) => {
  try {
    const { sub: memberId, tenant_slug: tenantSlug } = req.auth as unknown as MemberAuth

    const [memberRows, subRows, statsRows, gymRows] = await Promise.all([
      tenantQuery<{
        id: string; name: string
        email: string; phone: string | null; avatar_url: string | null
        joined_at: string; qr_code: string | null; status: string
        pin_hash: string | null
        emergency_contact_name: string | null
        emergency_contact_phone: string | null
        emergency_contact_relation: string | null
      }>(
        tenantSlug,
        `SELECT id, name, email, phone, avatar_url,
                joined_at, qr_code, status, pin_hash,
                emergency_contact_name, emergency_contact_phone, emergency_contact_relation
         FROM members WHERE id = $1 LIMIT 1`,
        [memberId],
      ),
      tenantQuery<{
        id: string; status: string; expires_at: string; started_at: string
        plan_name: string; plan_price: number; auto_renew: boolean
      }>(
        tenantSlug,
        `SELECT s.id, s.status, s.expires_at, s.started_at, s.auto_renew,
                mp.name as plan_name, mp.price as plan_price
         FROM subscriptions s
         LEFT JOIN membership_plans mp ON mp.id = s.plan_id
         WHERE s.member_id = $1
           AND s.status IN ('active','expiring_soon','grace_period')
         ORDER BY s.expires_at DESC LIMIT 1`,
        [memberId],
      ),
      tenantQuery<{ visits: string; last_visit: string | null }>(
        tenantSlug,
        `SELECT
           COUNT(*) FILTER (WHERE checked_in_at >= date_trunc('month', NOW())) AS visits,
           MAX(checked_in_at) AS last_visit
         FROM check_ins WHERE member_id = $1`,
        [memberId],
      ),
      globalQuery<{ name: string; logo_url: string | null; primary_color: string; currency: string }>(
        `SELECT name, logo_url, primary_color, currency FROM tenants WHERE slug = $1 LIMIT 1`,
        [tenantSlug],
      ),
    ])

    const member = memberRows.rows[0]
    if (!member) return res.status(404).json({ error: 'Member not found.' })

    return res.json({
      member: {
        ...member,
        has_pin: !!member.pin_hash,
        pin_hash: undefined, // never expose hash to client
        emergency_contact: member.emergency_contact_name ? {
          name:     member.emergency_contact_name,
          phone:    member.emergency_contact_phone,
          relation: member.emergency_contact_relation,
        } : null,
      },
      subscription: subRows.rows[0] ?? null,
      stats: {
        visitsThisMonth: parseInt(statsRows.rows[0]?.visits ?? '0', 10),
        lastVisit: statsRows.rows[0]?.last_visit ?? null,
      },
      gym: gymRows.rows[0] ?? null,
    })
  } catch (err) {
    console.error('[member-me/GET /]', err)
    return res.status(500).json({ error: 'Failed to load profile.' })
  }
})

// ─── GET /api/member/me/receipts ─────────────────────────────────────────────

memberMeRouter.get('/receipts', async (req, res) => {
  try {
    const { sub: memberId, tenant_slug: tenantSlug } = req.auth as unknown as MemberAuth

    const { rows } = await tenantQuery<{
      id: string; amount: number; currency: string
      provider: string; tranzak_ref: string | null
      status: string; payment_type: string
      paid_at: string | null; created_at: string
      plan_name: string | null
    }>(
      tenantSlug,
      `SELECT p.id, p.amount, p.currency, p.provider, p.provider_ref AS tranzak_ref,
              p.status, p.payment_type, p.paid_at, p.created_at,
              mp.name as plan_name
       FROM payments p
       LEFT JOIN subscriptions s ON s.id = p.subscription_id
       LEFT JOIN membership_plans mp ON mp.id = s.plan_id
       WHERE p.member_id = $1 AND p.status = 'completed'
       ORDER BY p.created_at DESC LIMIT 50`,
      [memberId],
    )

    return res.json({ receipts: rows })
  } catch (err) {
    console.error('[member-me/receipts]', err)
    return res.status(500).json({ error: 'Failed to load receipts.' })
  }
})

// ─── GET /api/member/me/schedule ─────────────────────────────────────────────

memberMeRouter.get('/schedule', async (req, res) => {
  try {
    const { sub: memberId, tenant_slug: tenantSlug } = req.auth as unknown as MemberAuth

    const { rows } = await tenantQuery<{
      booking_id: string; booking_status: string
      class_id: string; scheduled_at: string; ends_at: string
      class_status: string; room: string | null; capacity: number
      class_name: string; duration_minutes: number
      trainer_name: string | null
      booked_count: string
    }>(
      tenantSlug,
      `SELECT
         cb.id as booking_id, cb.status as booking_status,
         c.id as class_id, c.starts_at as scheduled_at, c.ends_at,
         c.status as class_status, c.location as room, c.capacity,
         c.name as class_name, c.duration_mins as duration_minutes,
         s.name as trainer_name,
         (SELECT COUNT(*) FROM class_bookings cb2 WHERE cb2.class_id = c.id AND cb2.status = 'confirmed') as booked_count
       FROM class_bookings cb
       JOIN classes c ON c.id = cb.class_id
       LEFT JOIN staff s ON s.id = c.trainer_id
       WHERE cb.member_id = $1
         AND cb.status IN ('confirmed','waitlisted')
         AND c.starts_at >= NOW()
         AND c.status != 'cancelled'
       ORDER BY c.starts_at ASC
       LIMIT 20`,
      [memberId],
    )

    return res.json({ bookings: rows })
  } catch (err) {
    console.error('[member-me/schedule]', err)
    return res.status(500).json({ error: 'Failed to load schedule.' })
  }
})

// ─── GET /api/member/me/classes ───────────────────────────────────────────────
// All upcoming classes (not just booked) for schedule browsing

memberMeRouter.get('/classes', async (req, res) => {
  try {
    const { sub: memberId, tenant_slug: tenantSlug } = req.auth as unknown as MemberAuth
    const days = Math.min(parseInt(req.query.days as string ?? '7', 10), 30)

    const { rows } = await tenantQuery<{
      class_id: string; scheduled_at: string; ends_at: string
      class_status: string; room: string | null; capacity: number
      class_name: string; duration_minutes: number
      trainer_name: string | null
      booked_count: string; my_booking_id: string | null; my_booking_status: string | null
    }>(
      tenantSlug,
      `SELECT
         c.id as class_id, c.starts_at as scheduled_at, c.ends_at,
         c.status as class_status, c.location as room, c.capacity,
         c.name as class_name, c.duration_mins as duration_minutes,
         s.name as trainer_name,
         (SELECT COUNT(*) FROM class_bookings cb2 WHERE cb2.class_id = c.id AND cb2.status = 'confirmed') as booked_count,
         mb.id as my_booking_id, mb.status as my_booking_status
       FROM classes c
       LEFT JOIN staff s ON s.id = c.trainer_id
       LEFT JOIN class_bookings mb ON mb.class_id = c.id AND mb.member_id = $1 AND mb.status != 'cancelled'
       WHERE c.starts_at BETWEEN NOW() AND NOW() + ($2 || ' days')::interval
         AND c.status != 'cancelled'
       ORDER BY c.starts_at ASC`,
      [memberId, String(days)],
    )

    return res.json({ classes: rows })
  } catch (err) {
    console.error('[member-me/classes]', err)
    return res.status(500).json({ error: 'Failed to load classes.' })
  }
})

// ─── GET /api/member/me/notifications ────────────────────────────────────────

memberMeRouter.get('/notifications', async (req, res) => {
  try {
    const { sub: memberId, tenant_slug: tenantSlug } = req.auth as unknown as MemberAuth

    const { rows } = await tenantQuery<{
      id: string; type: string; title: string; body: string
      read_at: string | null; created_at: string
    }>(
      tenantSlug,
      `SELECT id, type, title, body, read_at, created_at
       FROM notifications
       WHERE member_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [memberId],
    )

    return res.json({ notifications: rows, unreadCount: rows.filter(n => !n.read_at).length })
  } catch (err) {
    console.error('[member-me/notifications]', err)
    return res.status(500).json({ error: 'Failed to load notifications.' })
  }
})

// ─── PATCH /api/member/me/notifications/:id/read ─────────────────────────────

memberMeRouter.patch('/notifications/:id/read', async (req, res) => {
  try {
    const { sub: memberId, tenant_slug: tenantSlug } = req.auth as unknown as MemberAuth
    const { id } = req.params

    await tenantQuery(
      tenantSlug,
      `UPDATE notifications SET read_at = NOW() WHERE id = $1 AND member_id = $2`,
      [id, memberId],
    )

    return res.json({ ok: true })
  } catch (err) {
    console.error('[member-me/notifications/:id/read]', err)
    return res.status(500).json({ error: 'Failed to mark as read.' })
  }
})

// ─── PATCH /api/member/me/notifications/read-all ─────────────────────────────

memberMeRouter.patch('/notifications/read-all', async (req, res) => {
  try {
    const { sub: memberId, tenant_slug: tenantSlug } = req.auth as unknown as MemberAuth

    await tenantQuery(
      tenantSlug,
      `UPDATE notifications SET read_at = NOW() WHERE member_id = $1 AND read_at IS NULL`,
      [memberId],
    )

    return res.json({ ok: true })
  } catch (err) {
    console.error('[member-me/notifications/read-all]', err)
    return res.status(500).json({ error: 'Failed to mark all as read.' })
  }
})

// ─── GET /api/member/me/referral ─────────────────────────────────────────────

memberMeRouter.get('/referral', async (req, res) => {
  try {
    const { sub: memberId, tenant_slug: tenantSlug } = req.auth as unknown as MemberAuth

    // Ensure member has a referral code
    const { rows: memberRows } = await tenantQuery<{ referral_code: string | null; name: string }>(
      tenantSlug,
      `SELECT referral_code, name FROM members WHERE id = $1 LIMIT 1`,
      [memberId],
    )
    let referralCode = memberRows[0]?.referral_code

    if (!referralCode) {
      const name = memberRows[0]?.name ?? 'MEMBER'
      const prefix = name.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 4).padEnd(2, 'X')
      referralCode = `${prefix}${Math.floor(1000 + Math.random() * 9000)}`
      await tenantQuery(tenantSlug, `UPDATE members SET referral_code = $1 WHERE id = $2`, [referralCode, memberId])
    }

    // Stats
    const { rows: statsRows } = await tenantQuery<{ total: string; converted: string; total_earned: string }>(
      tenantSlug,
      `SELECT
         COUNT(*)::TEXT                                          AS total,
         COUNT(*) FILTER (WHERE status = 'converted')::TEXT     AS converted,
         COALESCE(SUM(reward_amount) FILTER (WHERE reward_applied_at IS NOT NULL), 0)::TEXT AS total_earned
       FROM referrals
       WHERE referrer_id = $1`,
      [memberId],
    )

    // Recent referred members (masked — initials only)
    const { rows: referredRows } = await tenantQuery<{ name: string; status: string; created_at: string }>(
      tenantSlug,
      `SELECT m.name, r.status, r.created_at
       FROM referrals r
       JOIN members m ON m.id = r.referred_id
       WHERE r.referrer_id = $1
       ORDER BY r.created_at DESC
       LIMIT 10`,
      [memberId],
    )

    const referred = referredRows.map(r => ({
      initials: r.name.split(' ').slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? '').join(''),
      status: r.status,
      created_at: r.created_at,
    }))

    res.json({
      referral_code: referralCode,
      total_referred: parseInt(statsRows[0]?.total ?? '0'),
      converted: parseInt(statsRows[0]?.converted ?? '0'),
      total_earned: parseFloat(statsRows[0]?.total_earned ?? '0'),
      referred,
    })
  } catch (err) {
    console.error('[member-me/referral]', err)
    res.status(500).json({ error: 'Failed to load referral data.' })
  }
})

// ─── POST /api/member/me/push-token ──────────────────────────────────────────

memberMeRouter.post('/push-token', async (req, res) => {
  try {
    const { sub: memberId, tenant_slug: tenantSlug } = req.auth as unknown as MemberAuth
    const { token } = req.body as { token: string }

    if (!token) return res.status(400).json({ error: 'token is required.' })

    await tenantQuery(
      tenantSlug,
      `UPDATE members SET push_token = $1, updated_at = NOW() WHERE id = $2`,
      [token, memberId],
    )

    return res.json({ ok: true })
  } catch (err) {
    // Column might not exist yet — non-fatal
    console.warn('[member-me/push-token]', err)
    return res.json({ ok: true })
  }
})

// ─── DELETE /api/member/me/push-token ────────────────────────────────────────

memberMeRouter.delete('/push-token', async (req, res) => {
  try {
    const { sub: memberId, tenant_slug: tenantSlug } = req.auth as unknown as MemberAuth
    await tenantQuery(
      tenantSlug,
      `UPDATE members SET push_token = NULL, updated_at = NOW() WHERE id = $1`,
      [memberId],
    )
    return res.json({ ok: true })
  } catch (err) {
    console.warn('[member-me/push-token DELETE]', err)
    return res.json({ ok: true })
  }
})

// ─── POST /api/member/me/pin ─────────────────────────────────────────────────
// Set or update member PIN (hashed). Used for kiosk fallback and PIN login.

memberMeRouter.post('/pin', async (req, res) => {
  try {
    const { sub: memberId, tenant_slug: tenantSlug } = req.auth as unknown as MemberAuth
    const { pin } = req.body as { pin?: string }

    if (!pin || !/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be 4–6 digits.' })
    }

    const bcrypt = await import('bcrypt')
    const hash = await bcrypt.hash(pin, 10)

    await tenantQuery(
      tenantSlug,
      `UPDATE members SET pin_hash = $1, updated_at = NOW() WHERE id = $2`,
      [hash, memberId],
    )

    return res.json({ ok: true })
  } catch (err) {
    console.error('[member-me/pin POST]', err)
    return res.status(500).json({ error: 'Failed to set PIN.' })
  }
})

// ─── DELETE /api/member/me/pin ────────────────────────────────────────────────
// Remove PIN

memberMeRouter.delete('/pin', async (req, res) => {
  try {
    const { sub: memberId, tenant_slug: tenantSlug } = req.auth as unknown as MemberAuth
    await tenantQuery(
      tenantSlug,
      `UPDATE members SET pin_hash = NULL, updated_at = NOW() WHERE id = $1`,
      [memberId],
    )
    return res.json({ ok: true })
  } catch (err) {
    console.error('[member-me/pin DELETE]', err)
    return res.status(500).json({ error: 'Failed to remove PIN.' })
  }
})

// ─── PATCH /api/member/me ───────────────────────────────────────────────────
// Update own profile (name, phone, emergency contact)

memberMeRouter.patch('/', async (req, res) => {
  try {
    const { sub: memberId, tenant_slug: tenantSlug } = req.auth as unknown as MemberAuth
    const { name, phone, emergency_contact } = req.body as {
      name?: string; phone?: string
      emergency_contact?: { name: string; phone: string; relation: string } | null
    }

    const params: unknown[] = []
    const sets: string[] = ['updated_at = NOW()']
    if (name?.trim()) { params.push(name.trim()); sets.push(`name = $${params.length}`) }
    if (phone !== undefined) { params.push(phone?.trim() || null); sets.push(`phone = $${params.length}`) }
    if (emergency_contact !== undefined) {
      params.push(emergency_contact?.name?.trim() || null); sets.push(`emergency_contact_name = $${params.length}`)
      params.push(emergency_contact?.phone?.trim() || null); sets.push(`emergency_contact_phone = $${params.length}`)
      params.push(emergency_contact?.relation?.trim() || null); sets.push(`emergency_contact_relation = $${params.length}`)
    }

    if (params.length === 0) return res.status(400).json({ error: 'Nothing to update.' })

    params.push(memberId)
    await tenantQuery(
      tenantSlug,
      `UPDATE members SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params,
    )

    return res.json({ ok: true })
  } catch (err) {
    console.error('[member-me/PATCH]', err)
    return res.status(500).json({ error: 'Failed to update profile.' })
  }
})

// ─── POST /api/member/me/bookings ───────────────────────────────────────────
// Book a class

memberMeRouter.post('/bookings', async (req, res) => {
  try {
    const { sub: memberId, tenant_slug: tenantSlug } = req.auth as unknown as MemberAuth
    const { class_id } = req.body as { class_id: string }

    if (!class_id) return res.status(400).json({ error: 'class_id is required.' })

    // Check capacity
    const { rows: classRows } = await tenantQuery<{ capacity: number }>(
      tenantSlug,
      `SELECT capacity FROM classes WHERE id = $1 AND status != 'cancelled'`,
      [class_id],
    )
    if (!classRows[0]) return res.status(404).json({ error: 'Class not found.' })

    const { rows: countRows } = await tenantQuery<{ count: string }>(
      tenantSlug,
      `SELECT COUNT(*) as count FROM class_bookings WHERE class_id = $1 AND status = 'confirmed'`,
      [class_id],
    )
    const count = parseInt(countRows[0]?.count ?? '0')

    const bookingId = uuid()
    const status = count >= classRows[0].capacity ? 'waitlisted' : 'confirmed'

    await tenantQuery(
      tenantSlug,
      `INSERT INTO class_bookings (id, class_id, member_id, status, booked_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (class_id, member_id) DO NOTHING`,
      [bookingId, class_id, memberId, status],
    )

    return res.status(201).json({ ok: true, id: bookingId, status })
  } catch (err) {
    console.error('[member-me/bookings POST]', err)
    return res.status(500).json({ error: 'Failed to book class.' })
  }
})

// ─── DELETE /api/member/me/bookings/:id ─────────────────────────────────────
// Cancel own booking

memberMeRouter.delete('/bookings/:id', async (req, res) => {
  try {
    const { sub: memberId, tenant_slug: tenantSlug } = req.auth as unknown as MemberAuth
    const { id } = req.params

    await tenantQuery(
      tenantSlug,
      `UPDATE class_bookings SET status = 'cancelled', cancelled_at = NOW()
       WHERE id = $1 AND member_id = $2`,
      [id, memberId],
    )

    return res.json({ ok: true })
  } catch (err) {
    console.error('[member-me/bookings DELETE]', err)
    return res.status(500).json({ error: 'Failed to cancel booking.' })
  }
})

// ─── POST /api/member/me/checkin ─────────────────────────────────────────────
// Flow 2: member scans gym QR code and self-records a check-in.
// Body: { token } — the kiosk JWT from the gym's QR code.

memberMeRouter.post('/checkin', async (req, res) => {
  try {
    const { sub: memberId, tenant_slug: tenantSlug } = req.auth as unknown as MemberAuth
    const { token } = req.body as { token?: string }

    if (!token) {
      return res.status(400).json({ ok: false, status: 'error', message: 'QR token is required.' })
    }

    // Verify the gym kiosk JWT
    let kioskTenant: string
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as { type: string; tenant: string }
      if (payload.type !== 'kiosk') {
        return res.status(400).json({ ok: false, status: 'error', message: 'Not a valid gym QR code.' })
      }
      kioskTenant = payload.tenant
    } catch {
      return res.status(400).json({ ok: false, status: 'error', message: 'QR code is invalid or expired.' })
    }

    // The member's tenant must match the gym's kiosk tenant
    if (kioskTenant !== tenantSlug) {
      return res.status(403).json({ ok: false, status: 'error', message: 'This QR belongs to a different gym.' })
    }

    // Fetch member + subscription
    const { rows } = await tenantQuery<{
      name: string
      sub_status: string | null
      expires_at: string | null
      plan_name: string | null
    }>(
      tenantSlug,
      `SELECT m.name,
              s.status  AS sub_status,
              s.expires_at,
              mp.name   AS plan_name
       FROM members m
       LEFT JOIN LATERAL (
         SELECT s2.status, s2.expires_at, s2.plan_id
         FROM subscriptions s2
         WHERE s2.member_id = m.id
         ORDER BY s2.created_at DESC LIMIT 1
       ) s ON TRUE
       LEFT JOIN membership_plans mp ON mp.id = s.plan_id
       WHERE m.id = $1 AND m.status != 'inactive'
       LIMIT 1`,
      [memberId],
    )

    const member = rows[0]
    if (!member) {
      return res.status(404).json({ ok: false, status: 'error', message: 'Member account not found.' })
    }

    const subStatus = member.sub_status
    const now = Date.now()
    const expiresAt = member.expires_at ? new Date(member.expires_at).getTime() : null
    const daysLeft = expiresAt ? Math.ceil((expiresAt - now) / 86400000) : null

    // Determine effective status
    let effectiveStatus: 'active' | 'expiring_soon' | 'grace_period' | 'expired' | 'suspended'
    let ok = true
    let message: string

    if (subStatus === 'suspended' || subStatus === 'cancelled') {
      effectiveStatus = 'suspended'
      ok = false
      message = 'Your membership is suspended. Please contact the gym.'
    } else if (!subStatus || subStatus === 'expired' || (expiresAt && expiresAt < now)) {
      effectiveStatus = 'expired'
      ok = false
      message = 'Your membership has expired. Please renew to continue.'
    } else if (subStatus === 'grace_period') {
      effectiveStatus = 'grace_period'
      ok = true
      message = 'You are in a grace period — please renew soon.'
    } else if (daysLeft !== null && daysLeft <= 7) {
      effectiveStatus = 'expiring_soon'
      ok = true
      message = `Your membership expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`
    } else {
      effectiveStatus = 'active'
      ok = true
      message = `Welcome, ${member.name.split(' ')[0]}!`
    }

    // Only record check-in if access is allowed
    if (ok) {
      const checkinId = uuid()
      await tenantQuery(
        tenantSlug,
        `INSERT INTO check_ins (id, member_id, method, checked_in_at)
         VALUES ($1, $2, 'member_qr_scan', NOW())`,
        [checkinId, memberId],
      )
    }

    return res.json({
      ok,
      member_name: member.name,
      plan_name:   member.plan_name ?? null,
      status:      effectiveStatus,
      message,
    })
  } catch (err) {
    console.error('[member-me/checkin POST]', err)
    return res.status(500).json({ ok: false, status: 'error', message: 'Check-in failed. Please try again.' })
  }
})

// ─── GET /api/member/me/checkin-history ──────────────────────────────────────

memberMeRouter.get('/checkin-history', async (req, res) => {
  try {
    const { sub: memberId, tenant_slug: tenantSlug } = req.auth as unknown as MemberAuth

    const limit = Math.min(Number(req.query.limit) || 60, 200)

    const { rows } = await tenantQuery<{
      id: string; method: string; checked_in_at: string
    }>(
      tenantSlug,
      `SELECT id, method, checked_in_at
       FROM check_ins
       WHERE member_id = $1
       ORDER BY checked_in_at DESC
       LIMIT $2`,
      [memberId, limit],
    )

    return res.json({ checkins: rows })
  } catch (err) {
    console.error('[member-me/checkin-history GET]', err)
    return res.status(500).json({ error: 'Failed to load check-in history.' })
  }
})

// ─── GET /api/member/me/sessions ─────────────────────────────────────────────

memberMeRouter.get('/sessions', async (req, res) => {
  try {
    const { sub: memberId, tenant_slug: tenantSlug, session_id } = req.auth as unknown as MemberAuth

    const { rows } = await tenantQuery<{
      id: string; device_name: string; device_type: string
      ip_address: string | null; location: string | null
      last_active_at: string
    }>(
      tenantSlug,
      `SELECT id, device_name, device_type, ip_address, location, last_active_at
       FROM member_sessions
       WHERE member_id = $1
         AND revoked = FALSE
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY last_active_at DESC`,
      [memberId],
    )

    const sessions = rows.map(s => ({
      id:             s.id,
      device_name:    s.device_name,
      device_type:    s.device_type as 'mobile' | 'tablet' | 'desktop',
      location:       s.location ?? s.ip_address ?? 'Unknown location',
      last_active_at: s.last_active_at,
      is_current:     s.id === session_id,
    }))

    return res.json({ sessions, alerts: [] })
  } catch (err) {
    console.error('[member-me/sessions GET]', err)
    return res.status(500).json({ error: 'Failed to load sessions.' })
  }
})

// ─── DELETE /api/member/me/sessions/others ────────────────────────────────────
// Must be registered before /:id to avoid route shadowing

memberMeRouter.delete('/sessions/others', async (req, res) => {
  try {
    const { sub: memberId, tenant_slug: tenantSlug, session_id } = req.auth as unknown as MemberAuth

    await tenantQuery(
      tenantSlug,
      `UPDATE member_sessions SET revoked = TRUE
       WHERE member_id = $1 AND id != $2`,
      [memberId, session_id ?? ''],
    )

    return res.json({ ok: true })
  } catch (err) {
    console.error('[member-me/sessions/others DELETE]', err)
    return res.status(500).json({ error: 'Failed to revoke sessions.' })
  }
})

// ─── DELETE /api/member/me/sessions/:id ──────────────────────────────────────

memberMeRouter.delete('/sessions/:id', async (req, res) => {
  try {
    const { sub: memberId, tenant_slug: tenantSlug } = req.auth as unknown as MemberAuth
    const { id } = req.params

    await tenantQuery(
      tenantSlug,
      `UPDATE member_sessions SET revoked = TRUE WHERE id = $1 AND member_id = $2`,
      [id, memberId],
    )

    return res.json({ ok: true })
  } catch (err) {
    console.error('[member-me/sessions/:id DELETE]', err)
    return res.status(500).json({ error: 'Failed to revoke session.' })
  }
})

// ─── GET /api/member/me/plans ─────────────────────────────────────────────────
// Returns the gym's active membership plans so the mobile Plans screen can
// display real prices and enable wallet payment.

memberMeRouter.get('/plans', async (req, res) => {
  try {
    const { tenant_slug: tenantSlug } = req.auth as unknown as MemberAuth
    const { rows } = await tenantQuery<{
      id: string; name: string; description: string | null
      price: string; currency: string; duration_days: number
      cycle: string; features: string | null
    }>(
      tenantSlug,
      `SELECT id, name, description, price, currency, duration_days, cycle, features
       FROM membership_plans
       WHERE is_active = TRUE
       ORDER BY price ASC`,
    )
    res.json({
      plans: rows.map(p => ({
        ...p,
        price: parseFloat(p.price),
        features: p.features ? (Array.isArray(p.features) ? p.features : JSON.parse(p.features)) : null,
      })),
    })
  } catch (err) {
    console.error('[member-me/plans]', err)
    res.status(500).json({ error: 'Failed to load plans.' })
  }
})

// ─── POST /api/member/me/redeem-voucher ───────────────────────────────────────
// Redeem a voucher code — credits the member's wallet with the voucher value.

memberMeRouter.post('/redeem-voucher', async (req, res) => {
  try {
    const { sub: memberId, tenant_slug: tenantSlug } = req.auth as unknown as MemberAuth
    const { code } = req.body as { code: string }

    if (!code?.trim()) return res.status(400).json({ error: 'Voucher code is required.' })

    const normalised = code.trim().toUpperCase()

    // Load voucher
    const { rows: vRows } = await tenantQuery<{
      id: string; value: string; currency: string; status: string; expires_at: string | null
    }>(
      tenantSlug,
      `SELECT id, value, currency, status, expires_at FROM vouchers WHERE code = $1 LIMIT 1`,
      [normalised],
    )
    const voucher = vRows[0]
    if (!voucher)                       return res.status(404).json({ error: 'Voucher code not found.' })
    if (voucher.status !== 'active')    return res.status(400).json({ error: `This voucher has already been ${voucher.status}.` })
    if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
      await tenantQuery(tenantSlug, `UPDATE vouchers SET status = 'expired' WHERE id = $1`, [voucher.id])
      return res.status(400).json({ error: 'This voucher has expired.' })
    }

    const credit = parseFloat(voucher.value)

    // Ensure wallet account exists
    await tenantQuery(
      tenantSlug,
      `INSERT INTO wallet_accounts (id, member_id, balance, currency)
       VALUES ($1, $2, 0, $3)
       ON CONFLICT (member_id) DO NOTHING`,
      [uuid(), memberId, voucher.currency],
    )

    // Credit wallet
    const { rows: walletRows } = await tenantQuery<{ balance: string }>(
      tenantSlug,
      `UPDATE wallet_accounts SET balance = balance + $1, updated_at = NOW()
       WHERE member_id = $2 RETURNING balance`,
      [credit, memberId],
    )

    // Record transaction
    await tenantQuery(
      tenantSlug,
      `INSERT INTO wallet_transactions (id, member_id, type, amount, description, status)
       VALUES ($1, $2, 'credit', $3, $4, 'completed')`,
      [uuid(), memberId, credit, `Voucher redemption — ${normalised}`],
    )

    // Mark voucher redeemed
    await tenantQuery(
      tenantSlug,
      `UPDATE vouchers SET status = 'redeemed', redeemed_by = $1, redeemed_at = NOW() WHERE id = $2`,
      [memberId, voucher.id],
    )

    const newBalance = parseFloat(walletRows[0]?.balance ?? '0')
    res.json({ ok: true, credit, newBalance, currency: voucher.currency })
  } catch (err) {
    console.error('[member-me/redeem-voucher]', err)
    res.status(500).json({ error: 'Failed to redeem voucher.' })
  }
})

// ─── POST /api/member/me/renew ────────────────────────────────────────────────
// Unified renewal endpoint supporting mobile_money, and cash.
// Wallet payments are handled by POST /api/member/wallet/pay-plan.

memberMeRouter.post('/renew', async (req, res) => {
  try {
    const { sub: memberId, tenant_slug: tenantSlug } = req.auth as unknown as MemberAuth
    const { plan_id, payment_method, phone } = req.body as {
      plan_id: string; payment_method: 'mobile_money' | 'cash'; phone?: string
    }

    if (!plan_id) return res.status(400).json({ error: 'plan_id is required.' })
    if (!['mobile_money', 'cash'].includes(payment_method)) {
      return res.status(400).json({ error: 'payment_method must be mobile_money or cash.' })
    }

    const { rows: planRows } = await tenantQuery<{
      id: string; name: string; price: number; currency: string; duration_days: number
    }>(
      tenantSlug,
      `SELECT id, name, price, currency, duration_days FROM membership_plans WHERE id = $1 AND is_active = TRUE LIMIT 1`,
      [plan_id],
    )
    const plan = planRows[0]
    if (!plan) return res.status(404).json({ error: 'Plan not found.' })

    // ── Cash ──────────────────────────────────────────────────────────────────
    if (payment_method === 'cash') {
      const newExpiry = new Date()
      newExpiry.setDate(newExpiry.getDate() + plan.duration_days)
      await tenantQuery(tenantSlug,
        `INSERT INTO subscriptions (id, member_id, plan_id, status, started_at, expires_at, created_at, updated_at)
         VALUES ($1, $2, $3, 'pending', NOW(), $4, NOW(), NOW())`,
        [uuid(), memberId, plan_id, newExpiry.toISOString()],
      )
      const reference = `REN-${memberId.slice(0, 8).toUpperCase()}`
      return res.json({ ok: true, method: 'cash', reference, plan_name: plan.name, amount: plan.price, currency: plan.currency })
    }

    // ── Mobile Money (Tranzak) ────────────────────────────────────────────────
    if (!phone) return res.status(400).json({ error: 'phone is required for mobile_money.' })
    if (!process.env.TRANZAK_APP_ID || !process.env.TRANZAK_APP_KEY) {
      return res.status(503).json({ error: 'Mobile payments not available. Contact your gym.' })
    }

    const { rows: subRows } = await tenantQuery<{ id: string }>(
      tenantSlug,
      `SELECT id FROM subscriptions WHERE member_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [memberId],
    )

    const paymentId = uuid()
    const reference = `mem-${paymentId}`
    const APP_URL = process.env.APP_URL ?? 'https://app.myfiti.app'

    await tenantQuery(
      tenantSlug,
      `INSERT INTO payments (id, member_id, subscription_id, amount, currency, provider, tranzak_ref, status, payment_type, created_at)
       VALUES ($1, $2, $3, $4, $5, 'tranzak', $6, 'pending', 'subscription', NOW())`,
      [paymentId, memberId, subRows[0]?.id ?? null, plan.price, plan.currency, reference],
    )

    const { chargeMobileWallet } = await import('../lib/tranzak.js')
    const { requestId } = await chargeMobileWallet({
      amount:      plan.price,
      currency:    plan.currency,
      phone,
      reference,
      description: `${plan.name} — ${tenantSlug}`,
      callbackUrl: `${APP_URL}/api/webhooks/tranzak?ctx=member&tenant=${tenantSlug}&id=${paymentId}`,
    })

    await tenantQuery(tenantSlug, `UPDATE payments SET tranzak_ref = $1 WHERE id = $2`, [requestId, paymentId])

    return res.json({ ok: true, payment_id: paymentId, request_id: requestId })
  } catch (err) {
    console.error('[member/me/renew]', err)
    return res.status(500).json({ error: 'Failed to initiate payment. Please try again.' })
  }
})

// ─── GET /api/member/me/payment/:paymentId ────────────────────────────────────
// Poll payment status — checks Tranzak live if still pending, updates DB.

memberMeRouter.get('/payment/:paymentId', async (req, res) => {
  try {
    const { sub: memberId, tenant_slug: tenantSlug } = req.auth as unknown as MemberAuth
    const { paymentId } = req.params

    const { rows } = await tenantQuery<{
      status: string; tranzak_ref: string | null; amount: number; currency: string
    }>(
      tenantSlug,
      `SELECT status, tranzak_ref, amount, currency FROM payments WHERE id = $1 AND member_id = $2 LIMIT 1`,
      [paymentId, memberId],
    )
    const payment = rows[0]
    if (!payment) return res.status(404).json({ error: 'Payment not found.' })

    if (payment.status === 'pending' && payment.tranzak_ref) {
      try {
        const { tranzak } = await import('../lib/tranzak.js')
        const v = await tranzak.verifyTransaction(payment.tranzak_ref)
        if (v.status === 'successful') {
          await tenantQuery(tenantSlug,
            `UPDATE payments SET status = 'completed', paid_at = NOW() WHERE id = $1`, [paymentId])
          return res.json({ status: 'completed', amount: payment.amount, currency: payment.currency })
        }
        if (v.status === 'failed') {
          await tenantQuery(tenantSlug,
            `UPDATE payments SET status = 'failed' WHERE id = $1`, [paymentId])
          return res.json({ status: 'failed', amount: payment.amount, currency: payment.currency })
        }
      } catch {
        // Tranzak unreachable — return current DB status
      }
    }

    return res.json({ status: payment.status, amount: payment.amount, currency: payment.currency })
  } catch (err) {
    console.error('[member/me/payment/:id GET]', err)
    return res.status(500).json({ error: 'Failed to check payment.' })
  }
})
