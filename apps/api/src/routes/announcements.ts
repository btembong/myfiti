import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import Expo from 'expo-server-sdk'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { tenantQuery } from '../db/client.js'

const expo = new Expo()

export const announcementsRouter = Router()

announcementsRouter.use(requireAuth)
announcementsRouter.use(requireRole('owner', 'admin'))

// ─── GET /api/announcements ─────────────────────────────────────────────────
// Returns deduplicated broadcast history (one row per sent announcement)

announcementsRouter.get('/', async (req, res) => {
  try {
    const { rows } = await tenantQuery(
      req.tenant.slug,
      `SELECT title, body, MIN(created_at) as sent_at, COUNT(*) as sent_count
       FROM notifications
       WHERE type = 'announcement'
       GROUP BY title, body
       ORDER BY sent_at DESC
       LIMIT 20`,
    )
    res.json({ announcements: rows })
  } catch (err) {
    console.error('[announcements GET]', err)
    res.status(500).json({ error: 'Failed to load announcements.' })
  }
})

// ─── GET /api/announcements/audience-count ──────────────────────────────────
// Returns how many members would receive a broadcast for the given segment

announcementsRouter.get('/audience-count', async (req, res) => {
  try {
    const { segment = 'active' } = req.query as { segment?: string }
    const where = segmentWhere(segment)
    const { rows } = await tenantQuery<{ count: string }>(
      req.tenant.slug,
      `SELECT COUNT(*) as count FROM members WHERE ${where}`,
    )
    res.json({ count: parseInt(rows[0]?.count ?? '0') })
  } catch (err) {
    console.error('[announcements/audience-count]', err)
    res.status(500).json({ error: 'Failed to count audience.' })
  }
})

// ─── POST /api/announcements ────────────────────────────────────────────────
// Broadcast an announcement to a segment of members

announcementsRouter.post('/', async (req, res) => {
  try {
    const { title, body, segment = 'active' } = req.body
    if (!title?.trim() || !body?.trim()) {
      return res.status(400).json({ error: 'title and body are required.' })
    }

    const where = segmentWhere(segment)
    const { rows: members } = await tenantQuery<{ id: string; push_token: string | null }>(
      req.tenant.slug,
      `SELECT id, push_token FROM members WHERE ${where}`,
    )

    if (members.length === 0) {
      return res.json({ ok: true, sent: 0, pushed: 0 })
    }

    // ── 1. Save in-app notifications ────────────────────────────────────────
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

    // ── 2. Send push notifications to members who have a token ──────────────
    const validTokens = members
      .map(m => m.push_token)
      .filter((t): t is string => !!t && Expo.isExpoPushToken(t))

    let pushed = 0
    if (validTokens.length > 0) {
      const messages = validTokens.map(token => ({
        to: token,
        sound: 'default' as const,
        title: title.trim(),
        body: body.trim(),
        data: { type: 'announcement' },
      }))

      const chunks = expo.chunkPushNotifications(messages)
      for (const chunk of chunks) {
        try {
          const receipts = await expo.sendPushNotificationsAsync(chunk)
          pushed += receipts.filter(r => r.status === 'ok').length
        } catch (err) {
          console.warn('[announcements push chunk]', err)
        }
      }
    }

    res.status(201).json({ ok: true, sent: members.length, pushed })
  } catch (err) {
    console.error('[announcements POST]', err)
    res.status(500).json({ error: 'Failed to send announcement.' })
  }
})

// ─── Helper ───────────────────────────────────────────────────────────────────

function segmentWhere(segment: string): string {
  switch (segment) {
    case 'all':      return `status NOT IN ('deleted')`
    case 'active':   return `status IN ('active', 'expiring_soon', 'grace_period')`
    case 'expiring': return `status = 'expiring_soon'`
    case 'expired':  return `status IN ('expired', 'inactive')`
    default:         return `status IN ('active', 'expiring_soon', 'grace_period')`
  }
}
