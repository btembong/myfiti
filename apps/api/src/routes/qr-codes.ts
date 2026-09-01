import { Router } from 'express'
import { tenantQuery, globalQuery } from '../db/client.js'
import { generateStyledQRCode } from '../lib/qr-generator.js'

export const qrCodesRouter = Router()

/**
 * GET /api/qr-codes/:memberId
 * Generate or return cached QR code for a member
 * Returns PNG image with custom styling (rounded corners + brand color)
 */
qrCodesRouter.get('/:memberId', async (req, res) => {
  try {
    const memberId = req.params.memberId.replace(/\.png$/i, '')

    // Determine tenant from member lookup
    // Try all tenants until we find the member
    const { rows: tenants } = await globalQuery<{ slug: string }>(
      `SELECT DISTINCT slug FROM tenants WHERE status != 'suspended' LIMIT 50`,
    )

    let memberQR: { qr_code: string; id: string } | null = null
    let gymLogoUrl: string | null = null
    let gymFinderColor: string = '#14B946'

    for (const tenant of tenants) {
      try {
        const { rows } = await tenantQuery<{ qr_code: string; id: string }>(
          tenant.slug,
          `SELECT qr_code, id FROM members WHERE id = $1 LIMIT 1`,
          [memberId],
        )
        if (rows[0]) {
          memberQR = rows[0]
          // Fetch gym branding for styled QR
          const { rows: gs } = await tenantQuery<{ logo_url: string | null; primary_color: string | null }>(
            tenant.slug,
            `SELECT logo_url, primary_color FROM gym_settings WHERE id = 'singleton' LIMIT 1`,
          )
          gymLogoUrl     = gs[0]?.logo_url    ?? null
          gymFinderColor = gs[0]?.primary_color ?? '#14B946'
          break
        }
      } catch {
        // Continue to next tenant
      }
    }

    if (!memberQR) {
      return res.status(404).json({ error: 'Member not found' })
    }

    // Generate styled QR matching mobile app (rounded dots, branded finder squares, logo)
    const qrBuffer = await generateStyledQRCode(memberQR.qr_code, {
      size: 300,
      logoUrl:     gymLogoUrl,
      finderColor: gymFinderColor,
    })

    // Return as PNG — cross-origin headers required for embedding in emails
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable') // Cache for 7 days
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.send(qrBuffer)
  } catch (err) {
    console.error('[qr-codes GET]', err)
    res.status(500).json({ error: 'Failed to generate QR code' })
  }
})

/**
 * Optional: GET /api/qr-codes/:memberId/base64
 * Return QR code as data URL for embedding in emails/PDFs
 */
qrCodesRouter.get('/:memberId/base64', async (req, res) => {
  try {
    const memberId = req.params.memberId.replace(/\.png$/i, '')

    // Determine tenant from member lookup
    const { rows: tenants } = await globalQuery<{ slug: string }>(
      `SELECT DISTINCT slug FROM tenants WHERE status != 'suspended' LIMIT 50`,
    )

    let memberQR: { qr_code: string; id: string } | null = null

    for (const tenant of tenants) {
      try {
        const { rows } = await tenantQuery<{ qr_code: string; id: string }>(
          tenant.slug,
          `SELECT qr_code, id FROM members WHERE id = $1 LIMIT 1`,
          [memberId],
        )
        if (rows[0]) {
          memberQR = rows[0]
          break
        }
      } catch {
        // Continue to next tenant
      }
    }

    if (!memberQR) {
      return res.status(404).json({ error: 'Member not found' })
    }

    // Generate QR code and return as base64 (pure black & white)
    const qrBuffer = await generateStyledQRCode(memberQR.qr_code, {
      size: 300,
    })

    const dataUrl = `data:image/png;base64,${qrBuffer.toString('base64')}`
    res.json({ ok: true, data_url: dataUrl })
  } catch (err) {
    console.error('[qr-codes/base64 GET]', err)
    res.status(500).json({ error: 'Failed to generate QR code' })
  }
})
