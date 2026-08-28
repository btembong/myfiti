import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { tenantQuery } from '../db/client.js'

export const announcementsRouter = Router()

announcementsRouter.use(requireAuth)
announcementsRouter.use(requireRole('owner', 'admin'))

// ─── GET /api/announcements ─────────────────────────────────────────────────

announcementsRouter.get('/', async (req, res) => {
  try {
    const { rows } = await tenantQuery(
      req.tenant.slug,
      `SELECT id, title, body, type, read_at, created_at
       FROM notifications
       WHERE type = 'announcement'
       ORDER BY created_at DESC
       LIMIT 50`,
    )
    res.json({ announcements: rows })
  } catch (err) {
    console.error('[announcements GET]', err)
    res.status(500).json({ error: 'Failed to load announcements.' })
  }
})

// ─── POST /api/announcements ────────────────────────────────────────────────
// Broadcast an announcement to all active members

announcementsRouter.post('/', async (req, res) => {
  try {
    const { title, body } = req.body
    if (!title?.trim() || !body?.trim()) {
      return res.status(400).json({ error: 'title and body are required.' })
    }

    // Get all active member IDs
    const { rows: members } = await tenantQuery<{ id: string }>(
      req.tenant.slug,
      `SELECT id FROM members WHERE status IN ('active', 'expiring_soon', 'grace_period')`,
    )

    if (members.length === 0) {
      return res.json({ ok: true, sent: 0 })
    }

    // Build batch insert values
    const params: unknown[] = []
    const valueGroups: string[] = []
    for (const member of members) {
      const id = uuid()
      const base = params.length
      params.push(id, member.id, title.trim(), body.trim())
      valueGroups.push(`($${base + 1}, $${base + 2}, 'announcement', 'in_app', $${base + 3}, $${base + 4}, NOW(), NOW())`)
    }

    await tenantQuery(
      req.tenant.slug,
      `INSERT INTO notifications (id, member_id, type, channel, title, body, sent_at, created_at)
       VALUES ${valueGroups.join(', ')}`,
      params,
    )

    res.status(201).json({ ok: true, sent: members.length })
  } catch (err) {
    console.error('[announcements POST]', err)
    res.status(500).json({ error: 'Failed to send announcement.' })
  }
})
