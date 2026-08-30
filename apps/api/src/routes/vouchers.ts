import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { tenantQuery } from '../db/client.js'

export const vouchersRouter = Router()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no O, 0, 1, I to avoid confusion
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `${seg()}-${seg()}-${seg()}`
}

// ─── Admin routes (require auth) ──────────────────────────────────────────────

vouchersRouter.use(requireAuth)

// GET /api/vouchers — list vouchers (admin)
vouchersRouter.get('/', requireRole('owner', 'admin', 'receptionist'), async (req, res) => {
  try {
    const status = (req.query.status as string) ?? ''
    const limit  = Math.min(200, parseInt((req.query.limit as string) ?? '100'))
    const offset = Math.max(0, parseInt((req.query.offset as string) ?? '0'))

    const conditions: string[] = []
    const params: unknown[]    = []

    if (status) { params.push(status); conditions.push(`v.status = $${params.length}`) }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    params.push(limit, offset)
    const limitIdx  = params.length - 1
    const offsetIdx = params.length

    const { rows } = await tenantQuery(
      req.tenant.slug,
      `SELECT v.*, m.name as redeemed_by_name
       FROM vouchers v
       LEFT JOIN members m ON m.id = v.redeemed_by
       ${where}
       ORDER BY v.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    )

    const { rows: totRows } = await tenantQuery<{ count: string }>(
      req.tenant.slug,
      `SELECT COUNT(*) as count FROM vouchers v ${where}`,
      params.slice(0, params.length - 2),
    )

    res.json({ vouchers: rows, total: parseInt(totRows[0]?.count ?? '0') })
  } catch (err) {
    console.error('[vouchers GET]', err)
    res.status(500).json({ error: 'Failed to load vouchers.' })
  }
})

// POST /api/vouchers/generate — create a batch of voucher codes (admin)
vouchersRouter.post('/generate', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const { count = 1, value, currency = 'XAF', expires_at, batch_label } = req.body as {
      count: number; value: number; currency?: string
      expires_at?: string; batch_label?: string
    }

    if (!value || value <= 0) return res.status(400).json({ error: 'value must be a positive number.' })
    if (count < 1 || count > 200) return res.status(400).json({ error: 'count must be between 1 and 200.' })

    const actor    = req.auth?.sub ?? 'staff'
    const expiryTs = expires_at ? new Date(expires_at).toISOString() : null
    const created: string[] = []

    for (let i = 0; i < count; i++) {
      let code = generateCode()
      // Retry on collision (extremely unlikely but safe)
      for (let retry = 0; retry < 5; retry++) {
        const { rows } = await tenantQuery<{ count: string }>(
          req.tenant.slug,
          `SELECT COUNT(*) as count FROM vouchers WHERE code = $1`,
          [code],
        )
        if (rows[0]?.count === '0') break
        code = generateCode()
      }

      await tenantQuery(
        req.tenant.slug,
        `INSERT INTO vouchers (id, code, value, currency, status, expires_at, batch_label, created_by)
         VALUES ($1, $2, $3, $4, 'active', $5, $6, $7)`,
        [uuid(), code, value, currency, expiryTs, batch_label ?? null, actor],
      )
      created.push(code)
    }

    res.json({ ok: true, codes: created, count: created.length })
  } catch (err) {
    console.error('[vouchers/generate POST]', err)
    res.status(500).json({ error: 'Failed to generate vouchers.' })
  }
})

// PATCH /api/vouchers/:id/cancel — cancel an unused voucher (admin)
vouchersRouter.patch('/:id/cancel', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const { id } = req.params
    const { rows } = await tenantQuery<{ status: string }>(
      req.tenant.slug,
      `SELECT status FROM vouchers WHERE id = $1 LIMIT 1`,
      [id],
    )
    if (!rows[0]) return res.status(404).json({ error: 'Voucher not found.' })
    if (rows[0].status === 'redeemed') return res.status(400).json({ error: 'Cannot cancel a redeemed voucher.' })

    await tenantQuery(
      req.tenant.slug,
      `UPDATE vouchers SET status = 'cancelled' WHERE id = $1`,
      [id],
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[vouchers/:id/cancel PATCH]', err)
    res.status(500).json({ error: 'Failed to cancel voucher.' })
  }
})

// ─── Member redeem route ───────────────────────────────────────────────────────
// POST /api/member/me/redeem-voucher
// (Mounted separately via memberMeRouter — imported from member-me.ts)
// This handler is exported and added there directly.
