/**
 * Seed script for korafit tenant
 * Run: node apps/api/scripts/seed-korafit.mjs
 */
import pg from 'pg'
import { randomUUID } from 'crypto'

const { Pool } = pg

const DATABASE_URL = 'postgresql://neondb_owner:npg_jYUZDgq26EXS@ep-red-hat-atoexznq-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
const SCHEMA = 'tenant_korafit'
const SLUG = 'korafit'

const pool = new Pool({ connectionString: DATABASE_URL })

async function q(sql, params = []) {
  const client = await pool.connect()
  try {
    return await client.query(sql, params)
  } finally {
    client.release()
  }
}

async function tq(sql, params = []) {
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO "${SCHEMA}", public`)
    return await client.query(sql, params)
  } finally {
    client.release()
  }
}

// ─── 1. Provision schema ──────────────────────────────────────────────────────

async function provisionSchema() {
  console.log('Provisioning schema…')
  const stmts = [
    `CREATE SCHEMA IF NOT EXISTS "${SCHEMA}"`,

    `CREATE TABLE IF NOT EXISTS "${SCHEMA}".staff (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      phone TEXT, password_hash TEXT NOT NULL, pin_hash TEXT,
      role TEXT NOT NULL DEFAULT 'receptionist', avatar_url TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS "${SCHEMA}".members (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      phone TEXT, avatar_url TEXT, status TEXT NOT NULL DEFAULT 'active',
      qr_code TEXT UNIQUE, referral_code TEXT UNIQUE, referred_by_id TEXT,
      notes TEXT, joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS "${SCHEMA}".membership_plans (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
      price DECIMAL(12,2) NOT NULL, currency TEXT NOT NULL DEFAULT 'XAF',
      duration_days INTEGER NOT NULL DEFAULT 30, cycle TEXT NOT NULL DEFAULT 'monthly',
      is_active BOOLEAN NOT NULL DEFAULT TRUE, features TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS "${SCHEMA}".subscriptions (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES "${SCHEMA}".members(id),
      plan_id TEXT NOT NULL REFERENCES "${SCHEMA}".membership_plans(id),
      status TEXT NOT NULL DEFAULT 'active',
      started_at TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
      grace_expires_at TIMESTAMPTZ, cancelled_at TIMESTAMPTZ,
      auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS "${SCHEMA}".payments (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES "${SCHEMA}".members(id),
      subscription_id TEXT REFERENCES "${SCHEMA}".subscriptions(id),
      amount DECIMAL(12,2) NOT NULL, currency TEXT NOT NULL DEFAULT 'XAF',
      provider TEXT NOT NULL DEFAULT 'tranzak', tranzak_ref TEXT,
      status TEXT NOT NULL DEFAULT 'pending', payment_type TEXT NOT NULL DEFAULT 'subscription',
      paid_at TIMESTAMPTZ, notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS "${SCHEMA}".check_ins (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES "${SCHEMA}".members(id),
      method TEXT NOT NULL DEFAULT 'qr',
      staff_id TEXT REFERENCES "${SCHEMA}".staff(id),
      checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS "${SCHEMA}".notifications (
      id TEXT PRIMARY KEY, member_id TEXT REFERENCES "${SCHEMA}".members(id),
      type TEXT NOT NULL, channel TEXT NOT NULL DEFAULT 'in_app',
      title TEXT NOT NULL, body TEXT NOT NULL,
      sent_at TIMESTAMPTZ, read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS "${SCHEMA}".referrals (
      id TEXT PRIMARY KEY,
      referrer_id TEXT NOT NULL REFERENCES "${SCHEMA}".members(id),
      referred_id TEXT REFERENCES "${SCHEMA}".members(id),
      status TEXT NOT NULL DEFAULT 'pending', converted_at TIMESTAMPTZ,
      reward_days INTEGER, reward_amount DECIMAL(12,2), reward_applied_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS "${SCHEMA}".classes (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
      trainer_id TEXT REFERENCES "${SCHEMA}".staff(id),
      capacity INTEGER NOT NULL DEFAULT 20, duration_mins INTEGER NOT NULL DEFAULT 60,
      starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL,
      recurrence TEXT, status TEXT NOT NULL DEFAULT 'scheduled', location TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS "${SCHEMA}".class_bookings (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL REFERENCES "${SCHEMA}".classes(id),
      member_id TEXT NOT NULL REFERENCES "${SCHEMA}".members(id),
      status TEXT NOT NULL DEFAULT 'confirmed',
      booked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), cancelled_at TIMESTAMPTZ,
      UNIQUE(class_id, member_id)
    )`,

    `CREATE TABLE IF NOT EXISTS "${SCHEMA}".day_passes (
      id TEXT PRIMARY KEY, guest_name TEXT NOT NULL, guest_phone TEXT,
      pass_type TEXT NOT NULL DEFAULT 'standard', amount DECIMAL(12,2) NOT NULL,
      currency TEXT NOT NULL DEFAULT 'XAF', payment_method TEXT NOT NULL DEFAULT 'cash',
      payment_ref TEXT, qr_token TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'active', valid_date TEXT NOT NULL,
      checked_in_at TIMESTAMPTZ, staff_id TEXT REFERENCES "${SCHEMA}".staff(id),
      converted_to_member_id TEXT REFERENCES "${SCHEMA}".members(id),
      notes TEXT, metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS "${SCHEMA}".gym_settings (
      id TEXT PRIMARY KEY DEFAULT 'singleton', gym_name TEXT NOT NULL,
      slug TEXT NOT NULL, country TEXT NOT NULL DEFAULT 'CM',
      timezone TEXT NOT NULL DEFAULT 'Africa/Douala', currency TEXT NOT NULL DEFAULT 'XAF',
      logo_url TEXT, primary_color TEXT DEFAULT '#6366f1',
      grace_period_days INTEGER NOT NULL DEFAULT 7, trial_days INTEGER NOT NULL DEFAULT 14,
      features JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE INDEX IF NOT EXISTS idx_members_status ON "${SCHEMA}".members(status)`,
    `CREATE INDEX IF NOT EXISTS idx_subscriptions_member_id ON "${SCHEMA}".subscriptions(member_id)`,
    `CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON "${SCHEMA}".subscriptions(status)`,
    `CREATE INDEX IF NOT EXISTS idx_subscriptions_expires_at ON "${SCHEMA}".subscriptions(expires_at)`,
    `CREATE INDEX IF NOT EXISTS idx_payments_member_id ON "${SCHEMA}".payments(member_id)`,
    `CREATE INDEX IF NOT EXISTS idx_payments_status ON "${SCHEMA}".payments(status)`,
    `CREATE INDEX IF NOT EXISTS idx_checkins_member_id ON "${SCHEMA}".check_ins(member_id)`,
    `CREATE INDEX IF NOT EXISTS idx_checkins_checked_in_at ON "${SCHEMA}".check_ins(checked_in_at)`,
  ]

  for (const stmt of stmts) {
    await q(stmt)
  }
  console.log('  Schema provisioned.')
}

// ─── 2. Gym settings ──────────────────────────────────────────────────────────

async function seedGymSettings() {
  console.log('Seeding gym_settings…')
  await tq(`
    INSERT INTO gym_settings (id, gym_name, slug, country, timezone, currency, primary_color, grace_period_days, trial_days)
    VALUES ('singleton', 'KoraFit', $1, 'CM', 'Africa/Douala', 'XAF', '#f97316', 7, 14)
    ON CONFLICT (id) DO UPDATE SET gym_name = EXCLUDED.gym_name, updated_at = NOW()
  `, [SLUG])
  console.log('  gym_settings done.')
}

// ─── 3. Membership plans ─────────────────────────────────────────────────────

const planMonthlyId = randomUUID()
const planQuarterlyId = randomUUID()
// Will be set after upsert (may differ if rows already existed)
let planMonthlyIdRef = planMonthlyId
let planQuarterlyIdRef = planQuarterlyId

async function seedPlans() {
  console.log('Seeding membership_plans…')
  // Upsert by name so we always get consistent IDs back
  const r1 = await tq(`
    INSERT INTO membership_plans (id, name, description, price, currency, duration_days, cycle, is_active, features)
    VALUES ($1, 'Monthly', 'Full access – 1 month', 15000, 'XAF', 30, 'monthly', true, 'Unlimited access, locker, towel')
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name RETURNING id
  `, [planMonthlyId])
  if (r1.rows.length) planMonthlyIdRef = r1.rows[0].id

  const r2 = await tq(`
    INSERT INTO membership_plans (id, name, description, price, currency, duration_days, cycle, is_active, features)
    VALUES ($1, 'Quarterly', 'Full access – 3 months', 40000, 'XAF', 90, 'quarterly', true, 'Unlimited access, locker, towel, 1 PT session')
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name RETURNING id
  `, [planQuarterlyId])
  if (r2.rows.length) planQuarterlyIdRef = r2.rows[0].id

  console.log('  Plans done.')
}

// ─── 4. Members ───────────────────────────────────────────────────────────────

const members = [
  { name: 'Amina Nkosi',      email: 'amina.nkosi@korafit.test',      phone: '+237670001001' },
  { name: 'Kofi Mensah',      email: 'kofi.mensah@korafit.test',       phone: '+237670001002' },
  { name: 'Fatou Diallo',     email: 'fatou.diallo@korafit.test',      phone: '+237670001003' },
  { name: 'Ibrahima Bah',     email: 'ibrahima.bah@korafit.test',      phone: '+237670001004' },
  { name: 'Ngozi Okafor',     email: 'ngozi.okafor@korafit.test',      phone: '+237670001005' },
  { name: 'Moussa Traoré',    email: 'moussa.traore@korafit.test',     phone: '+237670001006' },
  { name: 'Aïssatou Camara',  email: 'aissatou.camara@korafit.test',   phone: '+237670001007' },
  { name: 'Emmanuel Tchoupo', email: 'emmanuel.tchoupo@korafit.test',  phone: '+237670001008' },
  { name: 'Seydou Coulibaly', email: 'seydou.coulibaly@korafit.test',  phone: '+237670001009' },
  { name: 'Binta Sow',        email: 'binta.sow@korafit.test',         phone: '+237670001010' },
].map(m => ({ ...m, id: randomUUID(), qr_code: randomUUID(), referral_code: randomUUID().slice(0, 8).toUpperCase() }))

async function seedMembers() {
  console.log('Seeding members…')
  for (const m of members) {
    const joinedAt = new Date(Date.now() - Math.floor(Math.random() * 180) * 86400000)
    const res = await tq(`
      INSERT INTO members (id, name, email, phone, status, qr_code, referral_code, joined_at, created_at)
      VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, $7)
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id
    `, [m.id, m.name, m.email, m.phone, m.qr_code, m.referral_code, joinedAt])
    // Update in-memory id to the actual DB id (may differ if row already existed)
    if (res.rows.length) m.id = res.rows[0].id
  }
  console.log('  Members done.')
}

// ─── 5. Subscriptions + payments ─────────────────────────────────────────────

async function seedSubscriptions() {
  console.log('Seeding subscriptions & payments…')
  // Clear existing to avoid stale FK issues
  await tq(`DELETE FROM payments`)
  await tq(`DELETE FROM subscriptions`)
  const now = new Date()

  const scenarios = [
    // active, expires in 20 days
    { member: members[0], plan: () => planMonthlyIdRef, status: 'active',   daysAgo: 10, durationDays: 30 },
    // active, expires in 5 days (expiring soon)
    { member: members[1], plan: () => planMonthlyIdRef, status: 'active',   daysAgo: 25, durationDays: 30 },
    // active quarterly
    { member: members[2], plan: () => planQuarterlyIdRef, status: 'active', daysAgo: 20, durationDays: 90 },
    // grace period (expires_at in past, grace_expires_at in future)
    { member: members[3], plan: () => planMonthlyIdRef, status: 'grace',    daysAgo: 35, durationDays: 30 },
    // expired
    { member: members[4], plan: () => planMonthlyIdRef, status: 'expired',  daysAgo: 60, durationDays: 30 },
    // active
    { member: members[5], plan: () => planMonthlyIdRef, status: 'active',   daysAgo: 5,  durationDays: 30 },
    // active
    { member: members[6], plan: () => planQuarterlyIdRef, status: 'active', daysAgo: 45, durationDays: 90 },
    // active
    { member: members[7], plan: () => planMonthlyIdRef, status: 'active',   daysAgo: 15, durationDays: 30 },
    // expired
    { member: members[8], plan: () => planMonthlyIdRef, status: 'expired',  daysAgo: 45, durationDays: 30 },
    // active
    { member: members[9], plan: () => planMonthlyIdRef, status: 'active',   daysAgo: 8,  durationDays: 30 },
  ]

  for (const s of scenarios) {
    const subId = randomUUID()
    const payId = randomUUID()
    const startedAt = new Date(now.getTime() - s.daysAgo * 86400000)
    const expiresAt = new Date(startedAt.getTime() + s.durationDays * 86400000)
    const graceExpiresAt = s.status === 'grace'
      ? new Date(expiresAt.getTime() + 7 * 86400000)
      : null
    const planId = s.plan()
    const amount = planId === planMonthlyIdRef ? 15000 : 40000
    const payStatus = ['expired', 'grace'].includes(s.status) ? 'paid' : 'paid'

    await tq(`
      INSERT INTO subscriptions (id, member_id, plan_id, status, started_at, expires_at, grace_expires_at, auto_renew)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      ON CONFLICT (id) DO NOTHING
    `, [subId, s.member.id, planId, s.status, startedAt, expiresAt, graceExpiresAt])

    await tq(`
      INSERT INTO payments (id, member_id, subscription_id, amount, currency, provider, status, payment_type, paid_at)
      VALUES ($1, $2, $3, $4, 'XAF', 'cash', $5, 'subscription', $6)
      ON CONFLICT (id) DO NOTHING
    `, [payId, s.member.id, subId, amount, payStatus, startedAt])
  }
  console.log('  Subscriptions & payments done.')
}

// ─── 6. Check-ins (last 30 days) ─────────────────────────────────────────────

async function seedCheckIns() {
  console.log('Seeding check-ins…')
  const now = Date.now()
  const activeMembers = members.filter((_, i) => [0,1,2,5,6,7,9].includes(i))

  for (let day = 0; day < 30; day++) {
    // 2-6 check-ins per day
    const count = 2 + Math.floor(Math.random() * 5)
    for (let c = 0; c < count; c++) {
      const m = activeMembers[Math.floor(Math.random() * activeMembers.length)]
      const ts = new Date(now - day * 86400000 - Math.floor(Math.random() * 28800000))
      await tq(`
        INSERT INTO check_ins (id, member_id, method, checked_in_at)
        VALUES ($1, $2, 'qr', $3)
        ON CONFLICT (id) DO NOTHING
      `, [randomUUID(), m.id, ts])
    }
  }
  console.log('  Check-ins done.')
}

// ─── 7. Platform invoices (global public schema) ──────────────────────────────

async function seedPlatformInvoices() {
  console.log('Seeding platform_invoices…')

  // Get korafit tenant id
  const { rows } = await q(`SELECT id FROM public.tenants WHERE slug = $1`, [SLUG])
  if (!rows.length) {
    console.warn('  WARNING: korafit tenant not found in public.tenants — skipping platform_invoices.')
    return
  }
  const tenantId = rows[0].id

  const inv1Id = randomUUID()
  const inv2Id = randomUUID()
  const paidAt = new Date(Date.now() - 35 * 86400000)
  const dueAt  = new Date(Date.now() - 5 * 86400000)

  const now2 = new Date()
  const d = (offsetDays) => new Date(now2.getTime() + offsetDays * 86400000)

  await q(`
    INSERT INTO public.platform_invoices (id, tenant_id, invoice_number, plan, amount_xaf, status, period_start, period_end, due_date, paid_at)
    VALUES ($1, $2, $3, 'growth', 9900, 'paid', $4, $5, $6, $7)
    ON CONFLICT (id) DO NOTHING
  `, [inv1Id, tenantId, 'INV-KOR-001', d(-35), d(-5), d(-35), d(-30)])

  await q(`
    INSERT INTO public.platform_invoices (id, tenant_id, invoice_number, plan, amount_xaf, status, period_start, period_end, due_date, paid_at)
    VALUES ($1, $2, $3, 'growth', 9900, 'overdue', $4, $5, $6, NULL)
    ON CONFLICT (id) DO NOTHING
  `, [inv2Id, tenantId, 'INV-KOR-002', d(-5), d(25), d(-5)])

  console.log('  Platform invoices done.')
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  try {
    await provisionSchema()
    await seedGymSettings()
    await seedPlans()
    await seedMembers()
    await seedSubscriptions()
    await seedCheckIns()
    await seedPlatformInvoices()
    console.log('\nSeed complete!')
  } catch (err) {
    console.error('Seed failed:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
