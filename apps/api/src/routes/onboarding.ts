import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { v4 as uuid } from 'uuid'
import { eq } from 'drizzle-orm'
import { db, globalSchema, sql, globalQuery } from '../db/client.js'
import { sendWelcomeEmail } from '../lib/email.js'
import { provisionTenantSchema } from '../db/provision.js'

export const onboardingRouter = Router()

// ─── POST /api/onboarding/complete ───────────────────────────────────────────

onboardingRouter.post('/complete', async (req, res) => {
  try {
    // Verify JWT
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Not authenticated.' })
    }
    const token = authHeader.slice(7)
    let payload: { sub: string; email: string }
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET!) as { sub: string; email: string }
    } catch {
      return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' })
    }

    const {
      gymName, slug, country, timezone, currency,
      primaryColor, logoDataUrl,
      selectedPlan,
      tranzakAppId, tranzakAppSecret,
    } = req.body

    if (!gymName || !slug || !country || !timezone) {
      return res.status(400).json({ error: 'Missing required gym info.' })
    }
    if (!selectedPlan) {
      return res.status(400).json({ error: 'Please select a myfiti plan.' })
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.status(400).json({ error: 'Invalid subdomain format.' })
    }

    // Load owner
    const [owner] = await db
      .select()
      .from(globalSchema.owners)
      .where(eq(globalSchema.owners.id, payload.sub))
      .limit(1)

    if (!owner) {
      return res.status(404).json({ error: 'Account not found.' })
    }
    if (!owner.email_verified) {
      return res.status(403).json({ error: 'Email not verified.' })
    }
    if (owner.onboarding_complete) {
      return res.status(400).json({ error: 'Onboarding already completed.' })
    }

    // Check slug uniqueness
    const slugExists = await db
      .select({ id: globalSchema.tenants.id })
      .from(globalSchema.tenants)
      .where(eq(globalSchema.tenants.slug, slug))
      .limit(1)

    if (slugExists.length > 0) {
      return res.status(409).json({ error: 'This subdomain is already taken. Please choose another.' })
    }

    const tenantId = uuid()
    const schemaName = `tenant_${slug.replace(/-/g, '_')}`
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days

    // 1. Create tenant row
    await db.insert(globalSchema.tenants).values({
      id: tenantId,
      name: gymName,
      slug,
      subdomain: slug,
      owner_email: owner.email,
      owner_name: owner.name,
      plan: selectedPlan,
      status: 'trialing',
      currency: currency ?? 'XAF',
      timezone,
      primary_color: primaryColor ?? '#4f46e5',
      logo_url: logoDataUrl ? `data:${logoDataUrl}` : null,
      tranzak_app_id: tranzakAppId ?? null,
      tranzak_app_secret: tranzakAppSecret ?? null,
      trial_ends_at: trialEndsAt,
    })

    // 1b. Assign account number (GYM-XXXXXX) using shared sequence
    await globalQuery(
      `UPDATE tenants
       SET account_number = 'GYM-' || LPAD(nextval('tenant_account_seq')::TEXT, 6, '0')
       WHERE id = $1 AND account_number IS NULL`,
      [tenantId],
    )

    // 2. Provision tenant schema + tables
    await provisionTenantSchema(schemaName)

    // 3. Insert owner as staff (role: owner) in tenant schema
    const staffId = uuid()
    await db.execute(sql.raw(`
      INSERT INTO "${schemaName}".staff
        (id, name, email, phone, password_hash, pin_hash, role, is_active, created_at, updated_at)
      VALUES
        ('${staffId}', '${owner.name.replace(/'/g, "''")}', '${owner.email}',
         '${(owner.phone ?? '').replace(/'/g, "''")}',
         '${owner.password_hash}', '${owner.pin_hash}',
         'owner', TRUE, NOW(), NOW())
    `))

    // 3b. Seed gym_settings singleton
    await db.execute(sql.raw(`
      INSERT INTO "${schemaName}".gym_settings
        (id, gym_name, slug, country, timezone, currency, primary_color)
      VALUES
        ('singleton', '${gymName.replace(/'/g, "''")}', '${slug}',
         '${(country ?? 'CM').replace(/'/g, "''")}',
         '${(timezone ?? 'Africa/Douala').replace(/'/g, "''")}',
         '${(currency ?? 'XAF').replace(/'/g, "''")}',
         '${(primaryColor ?? '#6366f1').replace(/'/g, "''")}')
      ON CONFLICT (id) DO NOTHING
    `))

    // 4. Mark owner onboarding complete
    await db
      .update(globalSchema.owners)
      .set({ onboarding_complete: true, tenant_id: tenantId, updated_at: new Date() })
      .where(eq(globalSchema.owners.id, owner.id))

    // 6. Issue active JWT
    const newToken = jwt.sign(
      { sub: owner.id, email: owner.email, tenant_id: tenantId, stage: 'active', onboardingComplete: true },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' },
    )

    // 7. Send welcome email (non-blocking)
    sendWelcomeEmail({ email: owner.email, name: owner.name }, gymName).catch(console.error)

    return res.json({ ok: true, token: newToken, tenantSlug: slug })
  } catch (err) {
    console.error('[onboarding/complete]', err)
    return res.status(500).json({ error: 'Onboarding failed. Please try again.' })
  }
})
