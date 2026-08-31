import QRCode from 'qrcode'
import fs from 'fs/promises'
import path from 'path'

// Create QR codes directory if it doesn't exist
const QR_CODES_DIR = path.join(process.cwd(), 'public', 'qr-codes')

async function ensureQRDir() {
  try {
    await fs.mkdir(QR_CODES_DIR, { recursive: true })
  } catch (err) {
    console.warn('[qr-generator] Failed to create QR directory:', err)
  }
}

/**
 * Generate a QR code PNG with standard black & white colors for maximum scanability
 * Pure black/white QR codes scan reliably on all devices and work best in emails/PDFs
 */
export async function generateStyledQRCode(
  value: string,
  options: {
    size?: number        // Output size in pixels, default 300
    filename?: string    // Optional filename to save
  } = {},
): Promise<Buffer> {
  const { size = 300, filename } = options

  try {
    // Generate QR code as PNG buffer with pure black & white
    const qrBuffer = await QRCode.toBuffer(value, {
      width: size,
      margin: 1,
      color: {
        dark: '#000000',      // Pure black for maximum contrast
        light: '#ffffff',     // Pure white background
      },
    })

    // Optionally save to disk for caching
    if (filename) {
      await ensureQRDir()
      const filepath = path.join(QR_CODES_DIR, filename)
      await fs.writeFile(filepath, qrBuffer)
    }

    return qrBuffer
  } catch (err) {
    console.error('[qr-generator] Failed to generate QR code:', err)
    throw new Error('Failed to generate QR code')
  }
}

/**
 * Generate QR code and return as data URL (base64)
 * Useful for emails and embeddings
 */
export async function generateStyledQRDataURL(value: string): Promise<string> {
  const buffer = await generateStyledQRCode(value)
  return `data:image/png;base64,${buffer.toString('base64')}`
}

/**
 * Get the URL for a cached QR code
 */
export function getQRCodeURL(memberId: string, apiUrl: string = process.env.API_URL ?? 'https://api.myfiti.fit'): string {
  return `${apiUrl}/qr-codes/${memberId}.png`
}
