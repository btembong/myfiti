import { db, sql, globalQuery } from './client.js'

/**
 * Idempotent — all statements use CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.
 * Safe to call multiple times and on existing schemas.
 */
export async function provisionTenantSchema(schemaName: string) {
  const stmts = [
    `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`,

    `CREATE TABLE IF NOT EXISTS "${schemaName}".staff (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      phone         TEXT,
      password_hash TEXT NOT NULL,
      pin_hash      TEXT,
      role          TEXT NOT NULL DEFAULT 'receptionist',
      avatar_url    TEXT,
      is_active     BOOLEAN NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS "${schemaName}".members (
      id               TEXT PRIMARY KEY,
      name             TEXT NOT NULL,
      email            TEXT NOT NULL UNIQUE,
      phone            TEXT,
      avatar_url       TEXT,
      status           TEXT NOT NULL DEFAULT 'active',
      qr_code          TEXT UNIQUE,
      pin              TEXT,
      referral_code    TEXT UNIQUE,
      referred_by_id   TEXT,
      notes            TEXT,
      joined_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // Idempotent column additions for existing tenant schemas
    `ALTER TABLE "${schemaName}".members ADD COLUMN IF NOT EXISTS pin TEXT`,
    `ALTER TABLE "${schemaName}".members ADD COLUMN IF NOT EXISTS pin_hash TEXT`,
    `ALTER TABLE "${schemaName}".members ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT`,
    // Backfill referral_code for existing members who have none
    `UPDATE "${schemaName}".members
     SET referral_code = UPPER(REGEXP_REPLACE(name, '[^a-zA-Z]', '', 'g') || FLOOR(1000 + RANDOM() * 9000)::TEXT)
     WHERE referral_code IS NULL`,
    `ALTER TABLE "${schemaName}".members ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT`,
    `ALTER TABLE "${schemaName}".members ADD COLUMN IF NOT EXISTS emergency_contact_relation TEXT`,
    `ALTER TABLE "${schemaName}".members ADD COLUMN IF NOT EXISTS push_token TEXT`,

    `CREATE TABLE IF NOT EXISTS "${schemaName}".membership_plans (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      description   TEXT,
      price         DECIMAL(12,2) NOT NULL,
      currency      TEXT NOT NULL DEFAULT 'XAF',
      duration_days INTEGER NOT NULL DEFAULT 30,
      cycle         TEXT NOT NULL DEFAULT 'monthly',
      is_active     BOOLEAN NOT NULL DEFAULT TRUE,
      features      TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS "${schemaName}".subscriptions (
      id               TEXT PRIMARY KEY,
      member_id        TEXT NOT NULL REFERENCES "${schemaName}".members(id),
      plan_id          TEXT NOT NULL REFERENCES "${schemaName}".membership_plans(id),
      status           TEXT NOT NULL DEFAULT 'active',
      started_at       TIMESTAMPTZ NOT NULL,
      expires_at       TIMESTAMPTZ NOT NULL,
      grace_expires_at TIMESTAMPTZ,
      cancelled_at     TIMESTAMPTZ,
      frozen_until     TIMESTAMPTZ,
      auto_renew       BOOLEAN NOT NULL DEFAULT TRUE,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // Idempotent column addition for existing tenant schemas that predate frozen_until
    `ALTER TABLE "${schemaName}".subscriptions ADD COLUMN IF NOT EXISTS frozen_until TIMESTAMPTZ`,

    `CREATE TABLE IF NOT EXISTS "${schemaName}".payments (
      id              TEXT PRIMARY KEY,
      member_id       TEXT NOT NULL REFERENCES "${schemaName}".members(id),
      subscription_id TEXT REFERENCES "${schemaName}".subscriptions(id),
      amount          DECIMAL(12,2) NOT NULL,
      currency        TEXT NOT NULL DEFAULT 'XAF',
      provider        TEXT NOT NULL DEFAULT 'tranzak',
      tranzak_ref     TEXT,
      status          TEXT NOT NULL DEFAULT 'pending',
      payment_type    TEXT NOT NULL DEFAULT 'subscription',
      paid_at         TIMESTAMPTZ,
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS "${schemaName}".check_ins (
      id             TEXT PRIMARY KEY,
      member_id      TEXT REFERENCES "${schemaName}".members(id),
      method         TEXT NOT NULL DEFAULT 'qr',
      staff_id       TEXT REFERENCES "${schemaName}".staff(id),
      notes          TEXT,
      checked_in_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // Idempotent fixes for existing tenant schemas
    `ALTER TABLE "${schemaName}".payments ADD COLUMN IF NOT EXISTS tranzak_ref TEXT`,
    `ALTER TABLE "${schemaName}".payments ADD COLUMN IF NOT EXISTS notes TEXT`,
    `ALTER TABLE "${schemaName}".day_passes ADD COLUMN IF NOT EXISTS tranzak_ref TEXT`,
    // If day_passes.status is an enum (some older schemas), add 'pending' so S2S flow works.
    // Safe no-op when status is already TEXT or enum already has the value.
    `DO $$ BEGIN
       IF EXISTS (
         SELECT 1 FROM pg_type t
         JOIN pg_namespace n ON n.oid = t.typnamespace
         WHERE n.nspname = '${schemaName}' AND t.typname = 'day_pass_status'
       ) THEN
         BEGIN
           EXECUTE 'ALTER TYPE "${schemaName}".day_pass_status ADD VALUE IF NOT EXISTS ''pending''';
           EXECUTE 'ALTER TYPE "${schemaName}".day_pass_status ADD VALUE IF NOT EXISTS ''expired''';
         EXCEPTION WHEN OTHERS THEN NULL;
         END;
       END IF;
     END $$`,
    `ALTER TABLE "${schemaName}".check_ins ALTER COLUMN member_id DROP NOT NULL`,
    `ALTER TABLE "${schemaName}".check_ins ADD COLUMN IF NOT EXISTS notes TEXT`,
    `DO $$ BEGIN
       IF NOT EXISTS (
         SELECT 1 FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
         JOIN pg_namespace n ON n.oid = t.relnamespace
         WHERE n.nspname = '${schemaName}'
           AND t.relname = 'class_bookings'
           AND c.contype = 'u'
       ) THEN
         EXECUTE 'ALTER TABLE "${schemaName}".class_bookings ADD CONSTRAINT class_bookings_class_id_member_id_key UNIQUE (class_id, member_id)';
       END IF;
     END $$`,

    `CREATE TABLE IF NOT EXISTS "${schemaName}".notifications (
      id         TEXT PRIMARY KEY,
      member_id  TEXT REFERENCES "${schemaName}".members(id),
      type       TEXT NOT NULL,
      channel    TEXT NOT NULL DEFAULT 'in_app',
      title      TEXT NOT NULL,
      body       TEXT NOT NULL,
      sent_at    TIMESTAMPTZ,
      read_at    TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS "${schemaName}".referrals (
      id                TEXT PRIMARY KEY,
      referrer_id       TEXT NOT NULL REFERENCES "${schemaName}".members(id),
      referred_id       TEXT REFERENCES "${schemaName}".members(id),
      status            TEXT NOT NULL DEFAULT 'pending',
      converted_at      TIMESTAMPTZ,
      reward_days       INTEGER,
      reward_amount     DECIMAL(12,2),
      reward_applied_at TIMESTAMPTZ,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS "${schemaName}".classes (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      description   TEXT,
      trainer_id    TEXT REFERENCES "${schemaName}".staff(id),
      capacity      INTEGER NOT NULL DEFAULT 20,
      duration_mins INTEGER NOT NULL DEFAULT 60,
      starts_at     TIMESTAMPTZ NOT NULL,
      ends_at       TIMESTAMPTZ NOT NULL,
      recurrence    TEXT,
      status        TEXT NOT NULL DEFAULT 'scheduled',
      location      TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS "${schemaName}".class_bookings (
      id           TEXT PRIMARY KEY,
      class_id     TEXT NOT NULL REFERENCES "${schemaName}".classes(id),
      member_id    TEXT NOT NULL REFERENCES "${schemaName}".members(id),
      status       TEXT NOT NULL DEFAULT 'confirmed',
      booked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      cancelled_at TIMESTAMPTZ,
      attended_at  TIMESTAMPTZ,
      UNIQUE(class_id, member_id)
    )`,

    `CREATE TABLE IF NOT EXISTS "${schemaName}".day_passes (
      id                       TEXT PRIMARY KEY,
      guest_name               TEXT NOT NULL,
      guest_phone              TEXT,
      pass_type                TEXT NOT NULL DEFAULT 'standard',
      amount                   DECIMAL(12,2) NOT NULL,
      currency                 TEXT NOT NULL DEFAULT 'XAF',
      payment_method           TEXT NOT NULL DEFAULT 'cash',
      payment_ref              TEXT,
      qr_token                 TEXT NOT NULL UNIQUE,
      status                   TEXT NOT NULL DEFAULT 'active',
      valid_date               TEXT NOT NULL,
      checked_in_at            TIMESTAMPTZ,
      staff_id                 TEXT REFERENCES "${schemaName}".staff(id),
      converted_to_member_id   TEXT REFERENCES "${schemaName}".members(id),
      notes                    TEXT,
      metadata                 JSONB,
      created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS "${schemaName}".subscription_events (
      id              TEXT PRIMARY KEY,
      subscription_id TEXT REFERENCES "${schemaName}".subscriptions(id) ON DELETE CASCADE,
      member_id       TEXT NOT NULL REFERENCES "${schemaName}".members(id) ON DELETE CASCADE,
      event_type      TEXT NOT NULL,
      details         JSONB,
      actor           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS "${schemaName}".gym_settings (
      id                TEXT PRIMARY KEY DEFAULT 'singleton',
      gym_name          TEXT NOT NULL,
      slug              TEXT NOT NULL,
      country           TEXT NOT NULL DEFAULT 'CM',
      timezone          TEXT NOT NULL DEFAULT 'Africa/Douala',
      currency          TEXT NOT NULL DEFAULT 'XAF',
      logo_url          TEXT,
      primary_color     TEXT DEFAULT '#6366f1',
      grace_period_days INTEGER NOT NULL DEFAULT 7,
      trial_days        INTEGER NOT NULL DEFAULT 14,
      features          JSONB DEFAULT '{}',
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS "${schemaName}".member_sessions (
      id             TEXT PRIMARY KEY,
      member_id      TEXT NOT NULL REFERENCES "${schemaName}".members(id) ON DELETE CASCADE,
      device_name    TEXT NOT NULL DEFAULT 'Unknown Device',
      device_type    TEXT NOT NULL DEFAULT 'mobile',
      ip_address     TEXT,
      location       TEXT,
      revoked        BOOLEAN NOT NULL DEFAULT FALSE,
      last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at     TIMESTAMPTZ,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── Wallet ───────────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS "${schemaName}".wallet_accounts (
      id         TEXT PRIMARY KEY,
      member_id  TEXT NOT NULL UNIQUE REFERENCES "${schemaName}".members(id) ON DELETE CASCADE,
      balance    DECIMAL(12,2) NOT NULL DEFAULT 0,
      currency   TEXT NOT NULL DEFAULT 'XAF',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS "${schemaName}".wallet_transactions (
      id          TEXT PRIMARY KEY,
      member_id   TEXT NOT NULL REFERENCES "${schemaName}".members(id) ON DELETE CASCADE,
      type        TEXT NOT NULL,
      amount      DECIMAL(12,2) NOT NULL,
      description TEXT NOT NULL,
      tranzak_ref TEXT,
      status      TEXT NOT NULL DEFAULT 'pending',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE INDEX IF NOT EXISTS idx_wallet_tx_member_id ON "${schemaName}".wallet_transactions(member_id)`,
    `CREATE INDEX IF NOT EXISTS idx_wallet_tx_created_at ON "${schemaName}".wallet_transactions(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_wallet_tx_tranzak_ref ON "${schemaName}".wallet_transactions(tranzak_ref) WHERE tranzak_ref IS NOT NULL`,

    // ── Vouchers ─────────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS "${schemaName}".vouchers (
      id            TEXT PRIMARY KEY,
      code          TEXT NOT NULL UNIQUE,
      value         DECIMAL(12,2) NOT NULL,
      currency      TEXT NOT NULL DEFAULT 'XAF',
      status        TEXT NOT NULL DEFAULT 'active',
      redeemed_by   TEXT REFERENCES "${schemaName}".members(id) ON DELETE SET NULL,
      redeemed_at   TIMESTAMPTZ,
      expires_at    TIMESTAMPTZ,
      batch_label   TEXT,
      created_by    TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_vouchers_code   ON "${schemaName}".vouchers(code)`,
    `CREATE INDEX IF NOT EXISTS idx_vouchers_status ON "${schemaName}".vouchers(status)`,

    // Indexes
    `CREATE INDEX IF NOT EXISTS idx_member_sessions_member_id ON "${schemaName}".member_sessions(member_id)`,
    `CREATE INDEX IF NOT EXISTS idx_members_status ON "${schemaName}".members(status)`,
    `CREATE INDEX IF NOT EXISTS idx_members_created_at ON "${schemaName}".members(created_at)`,
    // Partial unique index: PINs must be unique but NULLs are excluded
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_members_pin ON "${schemaName}".members(pin) WHERE pin IS NOT NULL`,

    `CREATE INDEX IF NOT EXISTS idx_subscriptions_member_id ON "${schemaName}".subscriptions(member_id)`,
    `CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON "${schemaName}".subscriptions(status)`,
    `CREATE INDEX IF NOT EXISTS idx_subscriptions_expires_at ON "${schemaName}".subscriptions(expires_at)`,
    `CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON "${schemaName}".subscriptions(plan_id)`,

    `CREATE INDEX IF NOT EXISTS idx_payments_member_id ON "${schemaName}".payments(member_id)`,
    `CREATE INDEX IF NOT EXISTS idx_payments_status ON "${schemaName}".payments(status)`,
    `CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON "${schemaName}".payments(paid_at)`,
    `CREATE INDEX IF NOT EXISTS idx_payments_created_at ON "${schemaName}".payments(created_at)`,

    `CREATE INDEX IF NOT EXISTS idx_checkins_member_id ON "${schemaName}".check_ins(member_id)`,
    `CREATE INDEX IF NOT EXISTS idx_checkins_checked_in_at ON "${schemaName}".check_ins(checked_in_at)`,

    `CREATE INDEX IF NOT EXISTS idx_class_bookings_class_id ON "${schemaName}".class_bookings(class_id)`,
    `CREATE INDEX IF NOT EXISTS idx_class_bookings_member_id ON "${schemaName}".class_bookings(member_id)`,

    `CREATE INDEX IF NOT EXISTS idx_classes_starts_at ON "${schemaName}".classes(starts_at)`,
    `CREATE INDEX IF NOT EXISTS idx_classes_trainer_id ON "${schemaName}".classes(trainer_id)`,

    `CREATE INDEX IF NOT EXISTS idx_notifications_member_id ON "${schemaName}".notifications(member_id)`,

    `CREATE INDEX IF NOT EXISTS idx_day_passes_valid_date ON "${schemaName}".day_passes(valid_date)`,
    `CREATE INDEX IF NOT EXISTS idx_day_passes_status ON "${schemaName}".day_passes(status)`,

    `CREATE INDEX IF NOT EXISTS idx_sub_events_subscription_id ON "${schemaName}".subscription_events(subscription_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sub_events_member_id ON "${schemaName}".subscription_events(member_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sub_events_created_at ON "${schemaName}".subscription_events(created_at DESC)`,

    // ── Financial audit log (PCI DSS Req 10) ─────────────────────────────────
    `CREATE TABLE IF NOT EXISTS "${schemaName}".financial_audit_log (
      id         TEXT PRIMARY KEY,
      actor_id   TEXT NOT NULL,
      actor_ip   TEXT,
      action     TEXT NOT NULL,
      amount     DECIMAL(12,2),
      currency   TEXT,
      reference  TEXT,
      metadata   JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_fin_audit_actor    ON "${schemaName}".financial_audit_log(actor_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_fin_audit_action   ON "${schemaName}".financial_audit_log(action, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_fin_audit_ref      ON "${schemaName}".financial_audit_log(reference) WHERE reference IS NOT NULL`,

    // ── Idempotent additions for existing tenant schemas ──────────────────────
    // wallet_transactions: context columns for secure webhook resolution (H4)
    `ALTER TABLE "${schemaName}".wallet_transactions ADD COLUMN IF NOT EXISTS expected_amount DECIMAL(12,2)`,
  ]

  for (const stmt of stmts) {
    try {
      await db.execute(sql.raw(stmt))
    } catch (err: unknown) {
      // Log but continue — a single statement failure should not block the rest.
      // This is safe because all statements are idempotent (IF NOT EXISTS / IF EXISTS).
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[provision] stmt skipped (${msg.slice(0, 120)}):`, stmt.slice(0, 80))
    }
  }
}

/**
 * Idempotent migrations for the global (public) schema.
 * Adds columns/indexes that aren't in the original Drizzle schema definition
 * but are required for security fixes.
 */
export async function migrateGlobalSchema() {
  const stmts = [
    // C2: unique transaction_ref on webhook_events for atomic idempotency
    `ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS transaction_ref TEXT`,
    `CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_txref_uidx ON webhook_events(transaction_ref)
     WHERE transaction_ref IS NOT NULL`,
  ]
  for (const stmt of stmts) {
    try {
      await globalQuery(stmt)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[provision-global] stmt skipped (${msg.slice(0, 120)})`)
    }
  }
}

/**
 * Run provisionTenantSchema for every active tenant.
 * Called at API startup to apply any schema additions to existing tenants.
 * Safe to run repeatedly — all statements are idempotent.
 */
export async function migrateAllTenants() {
  try {
    const { rows: tenants } = await globalQuery<{ slug: string }>(
      `SELECT slug FROM tenants WHERE status != 'suspended'`,
    )
    for (const t of tenants) {
      const schemaName = `tenant_${t.slug.replace(/-/g, '_')}`
      await provisionTenantSchema(schemaName)
    }
    if (tenants.length > 0) {
      console.log(`[migrate] schema applied to ${tenants.length} tenant(s)`)
    }
  } catch (err) {
    // Non-fatal — log and continue
    console.error('[migrate] schema migration error:', err)
  }
}
