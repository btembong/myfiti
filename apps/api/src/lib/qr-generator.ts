import * as QRCodeLib from 'qrcode'
import sharp from 'sharp'

const QUIET = 1  // quiet-zone modules on each side

function isFinderZone(r: number, c: number, n: number): boolean {
  return (
    (r < 7 && c < 7) ||
    (r < 7 && c >= n - 7) ||
    (r >= n - 7 && c < 7)
  )
}

/**
 * Build an SVG string matching the mobile app's StyledQRCode component:
 * - Rounded data dots
 * - Green (#14B946) rounded finder-pattern squares
 * - Optional gym logo in the center
 */
function buildQRSvg(opts: {
  value: string
  size: number
  dotColor?: string
  finderColor?: string
  backgroundColor?: string
  logoSvgData?: string   // raw base64-encoded PNG of the logo
  logoMime?: string
}): string {
  const {
    value,
    size,
    dotColor      = '#111111',
    finderColor   = '#14B946',
    backgroundColor = '#ffffff',
    logoSvgData,
    logoMime      = 'image/png',
  } = opts

  const ecl = logoSvgData ? 'H' : 'M'
  const qr  = QRCodeLib.create(value, { errorCorrectionLevel: ecl })
  const { data, size: n } = qr.modules

  const m   = size / (n + QUIET * 2)   // pixels per module
  const q   = QUIET * m                 // quiet-zone offset
  const pad = m * 0.12                  // gap between neighbouring dots

  const finderAnchors = [
    { r: 0,     c: 0     },
    { r: 0,     c: n - 7 },
    { r: n - 7, c: 0     },
  ]

  // ── Data dots ──────────────────────────────────────────────────────────────
  const dots: string[] = []
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!data[r * n + c]) continue
      if (isFinderZone(r, c, n)) continue
      const x  = q + c * m
      const y  = q + r * m
      const rx = m * 0.25
      dots.push(
        `<rect x="${(x + pad).toFixed(2)}" y="${(y + pad).toFixed(2)}" width="${(m - pad * 2).toFixed(2)}" height="${(m - pad * 2).toFixed(2)}" rx="${rx.toFixed(2)}" fill="${dotColor}"/>`
      )
    }
  }

  // ── Finder patterns ────────────────────────────────────────────────────────
  const finders: string[] = []
  for (const { r, c } of finderAnchors) {
    const x  = q + c * m
    const y  = q + r * m
    const fp = 7 * m
    finders.push(
      `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${fp.toFixed(2)}" height="${fp.toFixed(2)}" rx="${(m * 1.6).toFixed(2)}" fill="${finderColor}"/>`,
      `<rect x="${(x + m).toFixed(2)}" y="${(y + m).toFixed(2)}" width="${(5 * m).toFixed(2)}" height="${(5 * m).toFixed(2)}" rx="${(m * 0.9).toFixed(2)}" fill="${backgroundColor}"/>`,
      `<rect x="${(x + 2 * m).toFixed(2)}" y="${(y + 2 * m).toFixed(2)}" width="${(3 * m).toFixed(2)}" height="${(3 * m).toFixed(2)}" rx="${(m * 0.6).toFixed(2)}" fill="${finderColor}"/>`,
    )
  }

  // ── Logo ───────────────────────────────────────────────────────────────────
  let logoEl = ''
  if (logoSvgData) {
    const logoSizePx = size * 0.18
    const logoPad    = logoSizePx * 0.18
    const logoBoxSz  = logoSizePx + logoPad * 2
    const logoOffset = (size - logoBoxSz) / 2
    logoEl = [
      `<rect x="${logoOffset.toFixed(2)}" y="${logoOffset.toFixed(2)}" width="${logoBoxSz.toFixed(2)}" height="${logoBoxSz.toFixed(2)}" rx="${(logoBoxSz * 0.22).toFixed(2)}" fill="${backgroundColor}"/>`,
      `<image href="data:${logoMime};base64,${logoSvgData}" x="${(logoOffset + logoPad).toFixed(2)}" y="${(logoOffset + logoPad).toFixed(2)}" width="${logoSizePx.toFixed(2)}" height="${logoSizePx.toFixed(2)}" preserveAspectRatio="xMidYMid meet"/>`,
    ].join('\n')
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${backgroundColor}"/>
  ${dots.join('\n  ')}
  ${finders.join('\n  ')}
  ${logoEl}
</svg>`
}

/**
 * Generate a styled QR code PNG matching the mobile app.
 * Rounded dots, green finder squares, optional gym logo in center.
 */
export async function generateStyledQRCode(
  value: string,
  opts: {
    size?: number
    logoUrl?: string | null
    finderColor?: string
    dotColor?: string
  } = {},
): Promise<Buffer> {
  const { size = 300, logoUrl, finderColor = '#14B946', dotColor = '#111111' } = opts

  // Fetch and encode logo if provided
  let logoSvgData: string | undefined
  let logoMime = 'image/png'
  if (logoUrl) {
    try {
      const r = await fetch(logoUrl, { signal: AbortSignal.timeout(4000) })
      if (r.ok) {
        const ct = r.headers.get('content-type') ?? 'image/png'
        logoMime = ct.split(';')[0].trim()
        const buf = Buffer.from(await r.arrayBuffer())
        logoSvgData = buf.toString('base64')
      }
    } catch {
      // Logo fetch failed — render without logo
    }
  }

  const svg = buildQRSvg({ value, size, dotColor, finderColor, backgroundColor: '#ffffff', logoSvgData, logoMime })
  return sharp(Buffer.from(svg)).png().toBuffer()
}

/**
 * Generate QR code and return as data URL (base64)
 */
export async function generateStyledQRDataURL(value: string): Promise<string> {
  const buffer = await generateStyledQRCode(value)
  return `data:image/png;base64,${buffer.toString('base64')}`
}
