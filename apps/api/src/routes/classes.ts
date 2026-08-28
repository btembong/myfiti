import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { tenantQuery } from '../db/client.js'

export const classesRouter = Router()

// ─── GET /api/classes/schedule ────────────────────────────────────────────────
// Today's class schedule for the kiosk — no auth required.

classesRouter.get('/schedule', async (req, res) => {
  try {
    const { from, to } = req.query as Record<string, string>
    const params: unknown[] = []
    const conditions: string[] = [`c.status = 'scheduled'`]
    if (from) { params.push(from); conditions.push(`c.starts_at >= $${params.length}`) }
    if (to) { params.push(to); conditions.push(`c.starts_at <= $${params.length}`) }

    const { rows } = await tenantQuery(
      req.tenant.slug,
      `SELECT c.id, c.name, c.capacity, c.duration_mins, c.starts_at, c.ends_at, c.location,
              s.name as trainer_name,
              COUNT(b.id) FILTER (WHERE b.status = 'confirmed') as booked_count
       FROM classes c
       LEFT JOIN staff s ON s.id = c.trainer_id
       LEFT JOIN class_bookings b ON b.class_id = c.id
       WHERE ${conditions.join(' AND ')}
       GROUP BY c.id, s.name
       ORDER BY c.starts_at ASC
       LIMIT 20`,
      params,
    )
    res.json({ classes: rows })
  } catch (err) {
    console.error('[classes/public GET]', err)
    res.json({ classes: [] })
  }
})

classesRouter.use(requireAuth)
classesRouter.use(requireRole('owner', 'admin', 'trainer'))

// ─── GET /api/classes ─────────────────────────────────────────────────────────
// List classes with optional date range filter

classesRouter.get('/', async (req, res) => {
  try {
    const { from, to, status, trainer_id } = req.query as Record<string, string>

    const params: unknown[] = []
    const conditions: string[] = []
    if (from) { params.push(from); conditions.push(`c.starts_at >= $${params.length}`) }
    if (to) { params.push(to); conditions.push(`c.starts_at <= $${params.length}`) }
    if (status) { params.push(status); conditions.push(`c.status = $${params.length}`) }
    if (trainer_id) { params.push(trainer_id); conditions.push(`c.trainer_id = $${params.length}`) }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const { rows } = await tenantQuery(
      req.tenant.slug,
      `SELECT c.*,
              s.name as trainer_name,
              COUNT(b.id) FILTER (WHERE b.status = 'confirmed') as booked_count,
              COUNT(b.id) FILTER (WHERE b.status = 'waitlisted') as waitlist_count
       FROM classes c
       LEFT JOIN staff s ON s.id = c.trainer_id
       LEFT JOIN class_bookings b ON b.class_id = c.id
       ${where}
       GROUP BY c.id, s.name
       ORDER BY c.starts_at ASC`,
      params,
    )

    res.json({ classes: rows })
  } catch (err) {
    console.error('[classes GET]', err)
    res.status(500).json({ error: 'Failed to load classes.' })
  }
})

// ─── POST /api/classes ────────────────────────────────────────────────────────

classesRouter.post('/', async (req, res) => {
  try {
    const { name, description, trainer_id, capacity, duration_mins, starts_at, ends_at, recurrence, location } = req.body
    if (!name || !starts_at || !ends_at) {
      return res.status(400).json({ error: 'name, starts_at, and ends_at are required.' })
    }

    const id = uuid()
    await tenantQuery(
      req.tenant.slug,
      `INSERT INTO classes (id, name, description, trainer_id, capacity, duration_mins, starts_at, ends_at, recurrence, location, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'scheduled', NOW(), NOW())`,
      [id, name, description ?? null, trainer_id ?? null, parseInt(capacity ?? '20'), parseInt(duration_mins ?? '60'), starts_at, ends_at, recurrence ?? null, location ?? null],
    )
    res.status(201).json({ id, ok: true })
  } catch (err) {
    console.error('[classes POST]', err)
    res.status(500).json({ error: 'Failed to create class.' })
  }
})

// ─── GET /api/classes/:id ─────────────────────────────────────────────────────

classesRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const [classResult, bookingsResult] = await Promise.all([
      tenantQuery(
        req.tenant.slug,
        `SELECT c.*, s.name as trainer_name
         FROM classes c
         LEFT JOIN staff s ON s.id = c.trainer_id
         WHERE c.id = $1
         LIMIT 1`,
        [id],
      ),
      tenantQuery(
        req.tenant.slug,
        `SELECT b.*, m.name as member_name, m.email as member_email, m.avatar_url
         FROM class_bookings b
         JOIN members m ON m.id = b.member_id
         WHERE b.class_id = $1
         ORDER BY b.booked_at ASC`,
        [id],
      ),
    ])

    if (!classResult.rows[0]) return res.status(404).json({ error: 'Class not found.' })
    res.json({ class: classResult.rows[0], bookings: bookingsResult.rows })
  } catch (err) {
    console.error('[classes/:id GET]', err)
    res.status(500).json({ error: 'Failed to load class.' })
  }
})

// ─── PATCH /api/classes/:id ───────────────────────────────────────────────────

classesRouter.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const allowed = ['name', 'description', 'trainer_id', 'capacity', 'duration_mins', 'starts_at', 'ends_at', 'recurrence', 'location', 'status']
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
      `UPDATE classes SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params,
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[classes/:id PATCH]', err)
    res.status(500).json({ error: 'Failed to update class.' })
  }
})

// ─── POST /api/classes/:id/book ───────────────────────────────────────────────
// Book a member into a class

classesRouter.post('/:id/book', async (req, res) => {
  try {
    const { id } = req.params
    const { member_id } = req.body
    if (!member_id) return res.status(400).json({ error: 'member_id is required.' })

    // Check capacity
    const { rows: classRows } = await tenantQuery<{ capacity: number }>(
      req.tenant.slug,
      `SELECT capacity FROM classes WHERE id = $1`,
      [id],
    )
    const cls = classRows[0]
    if (!cls) return res.status(404).json({ error: 'Class not found.' })

    const { rows: countRows } = await tenantQuery<{ count: string }>(
      req.tenant.slug,
      `SELECT COUNT(*) as count FROM class_bookings WHERE class_id = $1 AND status = 'confirmed'`,
      [id],
    )
    const count = parseInt(countRows[0]?.count ?? '0')

    const bookingId = uuid()
    const status = count >= cls.capacity ? 'waitlisted' : 'confirmed'
    await tenantQuery(
      req.tenant.slug,
      `INSERT INTO class_bookings (id, class_id, member_id, status, booked_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (class_id, member_id) DO NOTHING`,
      [bookingId, id, member_id, status],
    )

    res.status(201).json({ id: bookingId, status, ok: true })
  } catch (err) {
    console.error('[classes/:id/book]', err)
    res.status(500).json({ error: 'Failed to book class.' })
  }
})

// ─── DELETE /api/classes/:id/book/:booking_id ─────────────────────────────────
// Cancel a booking

classesRouter.delete('/:id/book/:booking_id', async (req, res) => {
  try {
    const { booking_id } = req.params
    await tenantQuery(
      req.tenant.slug,
      `UPDATE class_bookings SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1`,
      [booking_id],
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[classes/book DELETE]', err)
    res.status(500).json({ error: 'Failed to cancel booking.' })
  }
})

// ─── POST /api/classes/:id/attendance ────────────────────────────────────────
// Mark attendance for a booking (attended / no_show)

classesRouter.post('/:id/attendance', async (req, res) => {
  try {
    const { id } = req.params
    const { booking_id, status } = req.body as { booking_id: string; status: 'attended' | 'no_show' }

    if (!booking_id || !['attended', 'no_show'].includes(status)) {
      return res.status(400).json({ error: 'booking_id and status (attended|no_show) are required.' })
    }

    await tenantQuery(
      req.tenant.slug,
      `UPDATE class_bookings SET status = $1, attended_at = CASE WHEN $1 = 'attended' THEN NOW() ELSE NULL END
       WHERE id = $2 AND class_id = $3`,
      [status, booking_id, id],
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[classes/:id/attendance]', err)
    res.status(500).json({ error: 'Failed to mark attendance.' })
  }
})

// ─── POST /api/classes/:id/attendance/bulk ──────────────────────────────────
// Mark attendance for all confirmed bookings at once

classesRouter.post('/:id/attendance/bulk', async (req, res) => {
  try {
    const { id } = req.params
    const { attendees, no_shows } = req.body as { attendees: string[]; no_shows: string[] }

    if (!attendees?.length && !no_shows?.length) {
      return res.status(400).json({ error: 'attendees or no_shows arrays are required.' })
    }

    const promises: Promise<unknown>[] = []
    if (attendees?.length) {
      const placeholders = attendees.map((_, i) => `$${i + 2}`).join(', ')
      promises.push(tenantQuery(
        req.tenant.slug,
        `UPDATE class_bookings SET status = 'attended', attended_at = NOW()
         WHERE class_id = $1 AND member_id IN (${placeholders})`,
        [id, ...attendees],
      ))
    }
    if (no_shows?.length) {
      const placeholders = no_shows.map((_, i) => `$${i + 2}`).join(', ')
      promises.push(tenantQuery(
        req.tenant.slug,
        `UPDATE class_bookings SET status = 'no_show'
         WHERE class_id = $1 AND member_id IN (${placeholders})`,
        [id, ...no_shows],
      ))
    }

    await Promise.all(promises)
    res.json({ ok: true })
  } catch (err) {
    console.error('[classes/:id/attendance/bulk]', err)
    res.status(500).json({ error: 'Failed to mark attendance.' })
  }
})
