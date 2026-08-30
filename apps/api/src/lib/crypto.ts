import crypto from 'node:crypto'

// ─── AES-256-GCM symmetric encryption for secrets stored in DB ───────────────
// Secrets (e.g. tranzak_app_secret) are stored as:
//   <iv_hex>:<ciphertext_hex>:<auth_tag_hex>
//
// The key comes from SECRET_ENCRYPTION_KEY env var (64 hex chars = 32 bytes).
// Generate one with:  openssl rand -hex 32

const ALGORITHM  = 'aes-256-gcm'
const IV_LENGTH  = 16
const KEY_HINT   = 'SECRET_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate: openssl rand -hex 32'

function getKey(): Buffer {
  const hex = process.env.SECRET_ENCRYPTION_KEY ?? ''
  if (hex.length !== 64) throw new Error(KEY_HINT)
  return Buffer.from(hex, 'hex')
}

/**
 * Encrypt a plaintext secret. Returns a <iv>:<enc>:<tag> string safe to store in DB.
 */
export function encryptSecret(plaintext: string): string {
  const key    = getKey()
  const iv     = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const enc    = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag    = cipher.getAuthTag()
  return `${iv.toString('hex')}:${enc.toString('hex')}:${tag.toString('hex')}`
}

/**
 * Decrypt a secret produced by encryptSecret().
 * Falls back to returning the value unchanged for legacy plain-text secrets
 * that haven't been migrated yet — this allows a rolling migration.
 */
export function decryptSecret(value: string): string {
  if (!isEncrypted(value)) return value   // legacy plain-text — pass through
  const [ivHex, encHex, tagHex] = value.split(':')
  try {
    const key      = getKey()
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'))
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
    return (
      decipher.update(Buffer.from(encHex, 'hex')).toString('utf8') +
      decipher.final('utf8')
    )
  } catch {
    // Decryption failed — could be a wrong key or a non-encrypted value that
    // happens to have two colons. Return as-is to avoid silently breaking auth.
    console.error('[crypto] decryptSecret failed — returning raw value')
    return value
  }
}

/**
 * Returns true if the value looks like an encrypted blob (iv:enc:tag hex triplet).
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(':')
  return (
    parts.length === 3 &&
    parts.every(p => p.length > 0 && /^[0-9a-f]+$/i.test(p))
  )
}
