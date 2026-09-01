import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { v4 as uuid } from 'uuid'
import crypto from 'crypto'
import { eq, sql } from 'drizzle-orm'
import { db, globalSchema, globalQuery, tenantQuery } from '../db/client.js'
import { sendOtpEmail, sendPasswordResetEmail } from '../lib/email.js'
import { rateLimitAuth } from '../middleware/rate-limit.js'

// ─── Session recording helper ─────────────────────────────────────────────────

function parseDevice(ua: string): string {
  if (/iPhone|iPad/.test(ua)) return 'iPhone'
  if (/Android/.test(ua)) return 'Android'
  if (/Windows/.test(ua)) return 'Windows'
  if (/Mac/.test(ua)) return 'Mac'
  return 'Unknown'
}

function parseBrowser(ua: string): string {
  if (/Edg\//.test(ua)) return 'Edge'
  if (/Chrome\/(\d+)/.test(ua)) return `Chrome ${ua.match(/Chrome\/(\d+)/)?.[1] ?? ''}`
  if (/Firefox\/(\d+)/.test(ua)) return `Firefox ${ua.match(/Firefox\/(\d+)/)?.[1] ?? ''}`
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return 'Safari'
  if (/curl/.test(ua)) return ua.slice(0, 20)
  return 'Unknown'
}

async function recordSession(opts: {
  userId: string; userName: string; userEmail: string; role: string
  tenantId?: string | null; tenantName?: string | null; tenantSlug?: string | null
  ip: string; ua: string; expiresAt: Date
}) {
  try {
    const id = uuid()
    await globalQuery(
      `INSERT INTO user_sessions
         (id, user_id, user_name, user_email, role, tenant_id, tenant_name, tenant_slug,
          ip_address, user_agent, device, browser, created_at, last_active_at, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW(),$13)`,
      [
        id, opts.userId, opts.userName, opts.userEmail, opts.role,
        opts.tenantId ?? null, opts.tenantName ?? null, opts.tenantSlug ?? null,
        opts.ip, opts.ua, parseDevice(opts.ua), parseBrowser(opts.ua),
        opts.expiresAt,
      ],
    )
  } catch {
    // Session recording is best-effort — never fail the login
  }
}

export const authRouter = Router()

// Apply rate limiting to all auth endpoints
authRouter.use(rateLimitAuth)

const SALT_ROUNDS = 12
const OTP_EXPIRY_MINUTES = 10
const JWT_EXPIRY = '7d'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function signToken(payload: object): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: JWT_EXPIRY })
}


// ─── POST /api/auth/register ─────────────────────────────────────────────────

authRouter.post('/register', async (req, res) => {
  try {
    const { name, email, phone, country, password, pin, referralCode, marketingOptIn } = req.body

    if (!name || !email || !phone || !country || !password || !pin) {
      return res.status(400).json({ error: 'All required fields must be provided.' })
    }
    if (!/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be exactly 4 digits.' })
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' })
    }

    // Check duplicate email
    const existing = await db
      .select({ id: globalSchema.owners.id })
      .from(globalSchema.owners)
      .where(eq(globalSchema.owners.email, email.toLowerCase()))
      .limit(1)

    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' })
    }

    const [passwordHash, pinHash] = await Promise.all([
      bcrypt.hash(password, SALT_ROUNDS),
      bcrypt.hash(pin, SALT_ROUNDS),
    ])

    const otp = generateOtp()
    const otpHash = await bcrypt.hash(otp, 10)
    const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

    await db.insert(globalSchema.owners).values({
      id: uuid(),
      name,
      email: email.toLowerCase(),
      phone,
      country,
      password_hash: passwordHash,
      pin_hash: pinHash,
      email_verified: false,
      email_otp: otpHash,
      email_otp_expires_at: otpExpiresAt,
      referral_code_used: referralCode ?? null,
      marketing_opt_in: marketingOptIn ?? false,
      onboarding_complete: false,
    })

    try {
      await sendOtpEmail({ email: email.toLowerCase(), name }, otp)
    } catch (emailErr) {
      console.error('[auth/register] Email send failed:', emailErr)
      // Still return success — user can resend OTP from verify screen
    }

    return res.status(201).json({ ok: true, message: 'Verification code sent to your email.' })
  } catch (err) {
    console.error('[auth/register]', err)
    return res.status(500).json({ error: 'Registration failed. Please try again.' })
  }
})

// ─── POST /api/auth/verify-email ─────────────────────────────────────────────

authRouter.post('/verify-email', async (req, res) => {
  try {
    const { email, otp } = req.body

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required.' })
    }

    const [owner] = await db
      .select()
      .from(globalSchema.owners)
      .where(eq(globalSchema.owners.email, email.toLowerCase()))
      .limit(1)

    if (!owner) {
      return res.status(404).json({ error: 'Account not found.' })
    }
    if (owner.email_verified) {
      return res.status(400).json({ error: 'Email is already verified.' })
    }
    if (!owner.email_otp || !owner.email_otp_expires_at) {
      return res.status(400).json({ error: 'No verification code found. Please request a new one.' })
    }
    if (new Date() > new Date(owner.email_otp_expires_at)) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' })
    }

    const otpValid = await bcrypt.compare(otp, owner.email_otp)
    if (!otpValid) {
      return res.status(400).json({ error: 'Incorrect verification code.' })
    }

    await db
      .update(globalSchema.owners)
      .set({ email_verified: true, email_otp: null, email_otp_expires_at: null, updated_at: new Date() })
      .where(eq(globalSchema.owners.id, owner.id))

    const token = signToken({
      sub: owner.id,
      role: 'owner',
      email: owner.email,
      stage: 'pre_onboarding',
      onboardingComplete: false,
    })

    return res.json({ ok: true, token })
  } catch (err) {
    console.error('[auth/verify-email]', err)
    return res.status(500).json({ error: 'Verification failed. Please try again.' })
  }
})

// ─── POST /api/auth/resend-otp ───────────────────────────────────────────────

authRouter.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ error: 'Email is required.' })
    }

    const [owner] = await db
      .select()
      .from(globalSchema.owners)
      .where(eq(globalSchema.owners.email, email.toLowerCase()))
      .limit(1)

    if (!owner) {
      return res.status(404).json({ error: 'Account not found.' })
    }
    if (owner.email_verified) {
      return res.status(400).json({ error: 'Email is already verified.' })
    }

    const otp = generateOtp()
    const otpHash = await bcrypt.hash(otp, 10)
    const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

    await db
      .update(globalSchema.owners)
      .set({ email_otp: otpHash, email_otp_expires_at: otpExpiresAt, updated_at: new Date() })
      .where(eq(globalSchema.owners.id, owner.id))

    try {
      await sendOtpEmail({ email: owner.email, name: owner.name }, otp)
    } catch (emailErr) {
      console.error('[auth/resend-otp] Email send failed:', emailErr)
    }

    return res.json({ ok: true, message: 'New verification code sent.' })
  } catch (err) {
    console.error('[auth/resend-otp]', err)
    return res.status(500).json({ error: 'Failed to resend code. Please try again.' })
  }
})

// ─── POST /api/auth/member/request-otp ───────────────────────────────────────

authRouter.post('/member/request-otp', async (req, res) => {
  try {
    const { tenantSlug, identifier } = req.body as { tenantSlug: string; identifier: string }
    if (!tenantSlug || !identifier) {
      return res.status(400).json({ error: 'tenantSlug and identifier (phone or email) are required.' })
    }

    // Resolve tenant
    const tenantRows = await globalQuery<{ id: string; name: string }>(
      `SELECT id, name FROM tenants WHERE slug = $1 LIMIT 1`,
      [tenantSlug],
    )
    if (!tenantRows.rows[0]) {
      return res.status(404).json({ error: 'Gym not found.' })
    }
    const { id: tenantId } = tenantRows.rows[0]

    // Lookup member in tenant schema
    const memberRows = await tenantQuery<{
      id: string; name: string
      email: string | null; phone: string | null; status: string
    }>(
      tenantSlug,
      `SELECT id, name, email, phone, status
       FROM members
       WHERE (LOWER(phone) = LOWER($1) OR LOWER(email) = LOWER($1))
         AND status != 'inactive'
       LIMIT 1`,
      [identifier.trim()],
    )

    if (!memberRows.rows[0]) {
      return res.status(404).json({ error: 'No active member found with that phone or email.' })
    }

    const member = memberRows.rows[0]
    if (!member.email) {
      return res.status(400).json({ error: 'This account has no email address. Please contact your gym.' })
    }

    const otp = generateOtp()
    const otpHash = await bcrypt.hash(otp, 10)
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)
    const key = `${tenantSlug}:${identifier.trim().toLowerCase()}`
    const otpId = uuid()

    // Delete any existing OTP for this identifier, then insert new one
    await globalQuery(
      `DELETE FROM member_otps WHERE tenant_slug = $1 AND identifier = $2`,
      [tenantSlug, key],
    )
    await globalQuery(
      `INSERT INTO member_otps (id, tenant_slug, tenant_id, identifier, otp_hash, member_id, member_email, member_name, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [otpId, tenantSlug, tenantId, key, otpHash, member.id, member.email, member.name, expiresAt.toISOString()],
    )

    try {
      await sendOtpEmail({ email: member.email, name: member.name }, otp)
    } catch (emailErr) {
      console.error('[auth/member/request-otp] Email send failed:', emailErr)
    }

    return res.json({ ok: true, message: 'Verification code sent to your email.' })
  } catch (err) {
    console.error('[auth/member/request-otp]', err)
    return res.status(500).json({ error: 'Failed to send verification code.' })
  }
})

// ─── POST /api/auth/member/verify-otp ────────────────────────────────────────

authRouter.post('/member/verify-otp', async (req, res) => {
  try {
    const { tenantSlug, identifier, otp, deviceName, deviceType } = req.body as {
      tenantSlug: string; identifier: string; otp: string
      deviceName?: string; deviceType?: 'mobile' | 'tablet' | 'desktop'
    }
    if (!tenantSlug || !identifier || !otp) {
      return res.status(400).json({ error: 'tenantSlug, identifier, and otp are required.' })
    }

    const key = `${tenantSlug}:${identifier.trim().toLowerCase()}`
    const { rows } = await globalQuery<{
      id: string; otp_hash: string; member_id: string; tenant_id: string
      tenant_slug: string; expires_at: string
    }>(
      `SELECT id, otp_hash, member_id, tenant_id, tenant_slug, expires_at
       FROM member_otps WHERE identifier = $1 LIMIT 1`,
      [key],
    )
    const entry = rows[0]

    if (!entry) {
      return res.status(400).json({ error: 'No pending verification code. Please request a new one.' })
    }
    if (new Date() > new Date(entry.expires_at)) {
      await globalQuery(`DELETE FROM member_otps WHERE id = $1`, [entry.id])
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' })
    }

    const valid = await bcrypt.compare(otp, entry.otp_hash)
    if (!valid) {
      return res.status(400).json({ error: 'Incorrect verification code.' })
    }

    // OTP verified — delete it
    await globalQuery(`DELETE FROM member_otps WHERE id = $1`, [entry.id])

    // Create a session row for device tracking
    const sessionId = uuid()
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? ''
    tenantQuery(
      tenantSlug,
      `INSERT INTO member_sessions (id, member_id, device_name, device_type, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '90 days')`,
      [sessionId, entry.member_id, deviceName ?? 'Unknown Device', deviceType ?? 'mobile', ip || null],
    ).catch(() => {}) // non-fatal if table not yet provisioned

    const token = signToken({
      sub: entry.member_id,
      role: 'member',
      tenant_id: entry.tenant_id,
      tenant_slug: tenantSlug,
      session_id: sessionId,
    })

    const refreshToken = signToken({
      sub: entry.member_id,
      role: 'member',
      tenant_id: entry.tenant_id,
      tenant_slug: tenantSlug,
      session_id: sessionId,
      type: 'refresh',
    })

    return res.json({ ok: true, token, refreshToken, memberId: entry.member_id })
  } catch (err) {
    console.error('[auth/member/verify-otp]', err)
    return res.status(500).json({ error: 'Verification failed.' })
  }
})

// ─── POST /api/auth/member/login-with-pin ────────────────────────────────────
// PIN-based member login — skips OTP email round-trip.
// Also used by kiosk for member fallback check-in (role=kiosk in body triggers checkin response).

authRouter.post('/member/login-with-pin', async (req, res) => {
  try {
    const { tenantSlug, identifier, pin, deviceName, deviceType } = req.body as {
      tenantSlug: string; identifier: string; pin: string
      deviceName?: string; deviceType?: 'mobile' | 'tablet' | 'desktop'
    }
    if (!tenantSlug || !identifier || !pin) {
      return res.status(400).json({ error: 'tenantSlug, identifier, and pin are required.' })
    }

    // Resolve tenant
    const tenantRows = await globalQuery<{ id: string }>(
      `SELECT id FROM tenants WHERE slug = $1 LIMIT 1`,
      [tenantSlug],
    )
    if (!tenantRows.rows[0]) return res.status(404).json({ error: 'Gym not found.' })
    const tenantId = tenantRows.rows[0].id

    // Look up member
    const { rows } = await tenantQuery<{
      id: string; name: string; status: string; pin_hash: string | null
    }>(
      tenantSlug,
      `SELECT id, name, status, pin_hash
       FROM members
       WHERE (LOWER(phone) = LOWER($1) OR LOWER(email) = LOWER($1))
         AND status != 'inactive'
       LIMIT 1`,
      [identifier.trim()],
    )
    const member = rows[0]
    if (!member) return res.status(404).json({ error: 'No active member found.' })
    if (!member.pin_hash) return res.status(400).json({ error: 'No PIN set. Please log in with OTP first.' })

    const valid = await bcrypt.compare(pin, member.pin_hash)
    if (!valid) return res.status(401).json({ error: 'Incorrect PIN.' })

    // Create session row
    const sessionId = uuid()
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? ''
    tenantQuery(
      tenantSlug,
      `INSERT INTO member_sessions (id, member_id, device_name, device_type, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '90 days')`,
      [sessionId, member.id, deviceName ?? 'Unknown Device', deviceType ?? 'mobile', ip || null],
    ).catch(() => {})

    const token = signToken({
      sub: member.id, role: 'member',
      tenant_id: tenantId, tenant_slug: tenantSlug,
      session_id: sessionId,
    })
    const refreshToken = signToken({
      sub: member.id, role: 'member',
      tenant_id: tenantId, tenant_slug: tenantSlug,
      session_id: sessionId, type: 'refresh',
    })

    return res.json({ ok: true, token, refreshToken, memberId: member.id })
  } catch (err) {
    console.error('[auth/member/login-with-pin]', err)
    return res.status(500).json({ error: 'Login failed.' })
  }
})

// ─── POST /api/auth/member/resend-otp ────────────────────────────────────────

authRouter.post('/member/resend-otp', async (req, res) => {
  try {
    const { tenantSlug, identifier } = req.body as { tenantSlug: string; identifier: string }
    if (!tenantSlug || !identifier) {
      return res.status(400).json({ error: 'tenantSlug and identifier are required.' })
    }

    const key = `${tenantSlug}:${identifier.trim().toLowerCase()}`
    const { rows } = await globalQuery<{
      id: string; member_email: string | null; member_name: string
    }>(
      `SELECT id, member_email, member_name FROM member_otps WHERE identifier = $1 LIMIT 1`,
      [key],
    )
    const existing = rows[0]
    if (!existing) {
      return res.status(400).json({ error: 'No pending session. Please start over.' })
    }

    const otp = generateOtp()
    const otpHash = await bcrypt.hash(otp, 10)
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

    await globalQuery(
      `UPDATE member_otps SET otp_hash = $1, expires_at = $2 WHERE id = $3`,
      [otpHash, expiresAt.toISOString(), existing.id],
    )

    if (existing.member_email) {
      try {
        await sendOtpEmail({ email: existing.member_email, name: existing.member_name }, otp)
      } catch (emailErr) {
        console.error('[auth/member/resend-otp] Email failed:', emailErr)
      }
    }

    return res.json({ ok: true, message: 'New verification code sent.' })
  } catch (err) {
    console.error('[auth/member/resend-otp]', err)
    return res.status(500).json({ error: 'Failed to resend code.' })
  }
})

// ─── POST /api/auth/login ────────────────────────────────────────────────────

authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' })
    }

    const [owner] = await db
      .select()
      .from(globalSchema.owners)
      .where(eq(globalSchema.owners.email, email.toLowerCase()))
      .limit(1)

    if (!owner) {
      return res.status(401).json({ error: 'Invalid email or password.' })
    }
    if (!owner.email_verified) {
      return res.status(403).json({ error: 'Please verify your email before signing in.', needsVerification: true })
    }

    const passwordValid = await bcrypt.compare(password, owner.password_hash)
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid email or password.' })
    }

    // Fetch tenant slug for the token payload
    let tenantSlug: string | null = null
    let resolvedTenantId: string | null = owner.tenant_id ?? null
    if (resolvedTenantId) {
      const [tenant] = await db
        .select({ slug: globalSchema.tenants.slug, status: globalSchema.tenants.status, name: globalSchema.tenants.name })
        .from(globalSchema.tenants)
        .where(eq(globalSchema.tenants.id, resolvedTenantId))
        .limit(1)
      if (tenant) {
        if (tenant.status === 'suspended' || tenant.status === 'cancelled') {
          return res.status(403).json({
            error: 'Your gym account has been suspended.',
            suspended: true,
            tenantName: tenant.name,
          })
        }
        tenantSlug = tenant.slug
      } else {
        // tenant_id is stale (tenant was re-seeded) — clear and fall through
        resolvedTenantId = null
      }
    }

    if (!resolvedTenantId) {
      // Fallback: find tenant by owner_email case-insensitively (handles seeded data)
      const [tenant] = await db
        .select({ id: globalSchema.tenants.id, slug: globalSchema.tenants.slug, status: globalSchema.tenants.status, name: globalSchema.tenants.name })
        .from(globalSchema.tenants)
        .where(sql`LOWER(${globalSchema.tenants.owner_email}) = LOWER(${owner.email})`)
        .limit(1)
      if (tenant) {
        if (tenant.status === 'suspended' || tenant.status === 'cancelled') {
          return res.status(403).json({
            error: 'Your gym account has been suspended.',
            suspended: true,
            tenantName: tenant.name,
          })
        }
        tenantSlug = tenant.slug
        resolvedTenantId = tenant.id
        // Self-heal: link this owner to their tenant
        await db
          .update(globalSchema.owners)
          .set({ tenant_id: tenant.id, onboarding_complete: true, updated_at: new Date() })
          .where(eq(globalSchema.owners.id, owner.id))
      }
    }

    const onboardingComplete = resolvedTenantId ? true : owner.onboarding_complete

    const token = signToken({
      sub: owner.id,
      role: 'owner',
      name: owner.name,
      email: owner.email,
      tenant_id: resolvedTenantId,
      tenant_slug: tenantSlug,
      onboardingComplete,
      stage: onboardingComplete ? 'active' : 'pre_onboarding',
    })

    const tenantName = resolvedTenantId
      ? (await db.select({ name: globalSchema.tenants.name }).from(globalSchema.tenants)
          .where(eq(globalSchema.tenants.id, resolvedTenantId)).limit(1))[0]?.name ?? null
      : null

    recordSession({
      userId: owner.id, userName: owner.name, userEmail: owner.email, role: 'owner',
      tenantId: resolvedTenantId, tenantName, tenantSlug,
      ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? '',
      ua: req.headers['user-agent'] ?? '',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })

    return res.json({ ok: true, token, onboardingComplete, tenantSlug })
  } catch (err) {
    console.error('[auth/login]', err)
    return res.status(500).json({ error: 'Login failed. Please try again.' })
  }
})

// ─── POST /api/auth/staff/login ─────────────────────────────────────────────
// Staff login with email + password (tenant-scoped)

authRouter.post('/staff/login', async (req, res) => {
  try {
    const { tenantSlug, email, password } = req.body
    if (!tenantSlug || !email || !password) {
      return res.status(400).json({ error: 'tenantSlug, email, and password are required.' })
    }

    // Resolve tenant
    const tenantRows = await globalQuery<{ id: string; slug: string }>(
      `SELECT id, slug FROM tenants WHERE slug = $1 AND status != 'suspended' LIMIT 1`,
      [tenantSlug],
    )
    if (!tenantRows.rows[0]) {
      return res.status(404).json({ error: 'Gym not found.' })
    }
    const tenant = tenantRows.rows[0]

    // Lookup staff in tenant schema
    const staffRows = await tenantQuery<{
      id: string; name: string; email: string
      password_hash: string; pin_hash: string | null
      role: string; is_active: boolean
    }>(
      tenantSlug,
      `SELECT id, name, email, password_hash, pin_hash, role, is_active
       FROM staff
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [email.trim()],
    )
    const staff = staffRows.rows[0]

    if (!staff || !staff.is_active) {
      return res.status(401).json({ error: 'Invalid credentials.' })
    }

    const valid = await bcrypt.compare(password, staff.password_hash)
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials.' })
    }

    const token = signToken({
      sub: staff.id,
      role: staff.role,
      tenant_id: tenant.id,
      tenant_slug: tenant.slug,
    })

    recordSession({
      userId: staff.id, userName: staff.name, userEmail: email.trim(), role: staff.role,
      tenantId: tenant.id, tenantName: null, tenantSlug: tenant.slug,
      ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? '',
      ua: req.headers['user-agent'] ?? '',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })

    return res.json({ ok: true, token, name: staff.name, role: staff.role })
  } catch (err) {
    console.error('[auth/staff/login]', err)
    return res.status(500).json({ error: 'Login failed.' })
  }
})

// ─── POST /api/auth/staff/pin ───────────────────────────────────────────────
// Staff quick login with email + 4-digit PIN

authRouter.post('/staff/pin', async (req, res) => {
  try {
    const { tenantSlug, email, pin } = req.body
    if (!tenantSlug || !email || !pin) {
      return res.status(400).json({ error: 'tenantSlug, email, and pin are required.' })
    }

    const tenantRows = await globalQuery<{ id: string; slug: string }>(
      `SELECT id, slug FROM tenants WHERE slug = $1 AND status != 'suspended' LIMIT 1`,
      [tenantSlug],
    )
    if (!tenantRows.rows[0]) {
      return res.status(404).json({ error: 'Gym not found.' })
    }
    const tenant = tenantRows.rows[0]

    const staffRows = await tenantQuery<{
      id: string; name: string; email: string
      pin_hash: string | null; role: string; is_active: boolean
    }>(
      tenantSlug,
      `SELECT id, name, email, pin_hash, role, is_active
       FROM staff
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [email.trim()],
    )
    const staff = staffRows.rows[0]

    if (!staff || !staff.is_active) {
      return res.status(401).json({ error: 'Invalid credentials.' })
    }
    if (!staff.pin_hash) {
      return res.status(400).json({ error: 'PIN login not set up for this account.' })
    }

    const valid = await bcrypt.compare(pin, staff.pin_hash)
    if (!valid) {
      return res.status(401).json({ error: 'Invalid PIN.' })
    }

    const token = signToken({
      sub: staff.id,
      role: staff.role,
      tenant_id: tenant.id,
      tenant_slug: tenant.slug,
    })

    return res.json({ ok: true, token, name: staff.name, role: staff.role })
  } catch (err) {
    console.error('[auth/staff/pin]', err)
    return res.status(500).json({ error: 'Login failed.' })
  }
})

// ─── POST /api/auth/forgot-password ─────────────────────────────────────────
// Request a password reset email (gym owner)

authRouter.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email is required.' })

    // Always return success to prevent email enumeration
    const [owner] = await db.select().from(globalSchema.owners)
      .where(eq(globalSchema.owners.email, email.toLowerCase().trim())).limit(1)

    if (owner) {
      const token = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      await globalQuery(
        `INSERT INTO password_resets (id, owner_id, token, expires_at, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [uuid(), owner.id, token, expiresAt.toISOString()],
      )

      await sendPasswordResetEmail(
        { email: owner.email, name: owner.name },
        token,
      ).catch(err => console.error('[auth/forgot-password] email error:', err))
    }

    return res.json({ ok: true, message: 'If an account exists with that email, a reset link has been sent.' })
  } catch (err) {
    console.error('[auth/forgot-password]', err)
    return res.status(500).json({ error: 'Failed to process reset request.' })
  }
})

// ─── POST /api/auth/reset-password ──────────────────────────────────────────
// Reset password using a valid token

authRouter.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body
    if (!token || !password) return res.status(400).json({ error: 'Token and new password are required.' })
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' })

    const result = await globalQuery<{ id: string; owner_id: string; expires_at: string; used_at: string | null }>(
      `SELECT id, owner_id, expires_at, used_at FROM password_resets
       WHERE token = $1 LIMIT 1`,
      [token],
    )
    const reset = result.rows[0]

    if (!reset) return res.status(400).json({ error: 'Invalid or expired reset token.' })
    if (reset.used_at) return res.status(400).json({ error: 'This reset link has already been used.' })
    if (new Date(reset.expires_at) < new Date()) return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' })

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

    await db.update(globalSchema.owners)
      .set({ password_hash: passwordHash, updated_at: new Date() })
      .where(eq(globalSchema.owners.id, reset.owner_id))

    await globalQuery(
      `UPDATE password_resets SET used_at = NOW() WHERE id = $1`,
      [reset.id],
    )

    return res.json({ ok: true, message: 'Password has been reset successfully.' })
  } catch (err) {
    console.error('[auth/reset-password]', err)
    return res.status(500).json({ error: 'Failed to reset password.' })
  }
})

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
// Stateless JWT — just clears the session record. Client must clear localStorage.

authRouter.post('/logout', async (req, res) => {
  try {
    const header = req.headers.authorization
    if (header?.startsWith('Bearer ')) {
      const token = header.slice(7)
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as { sub?: string }
        if (payload.sub) {
          await globalQuery(
            `DELETE FROM user_sessions WHERE user_id = $1`,
            [payload.sub],
          ).catch(() => {}) // session table is optional
        }
      } catch {
        // Invalid token — still return OK so client can clear localStorage
      }
    }
    return res.json({ ok: true })
  } catch (err) {
    console.error('[auth/logout]', err)
    return res.json({ ok: true }) // Always succeed — client clears localStorage regardless
  }
})
