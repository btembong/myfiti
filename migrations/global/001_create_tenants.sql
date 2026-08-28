CREATE TABLE IF NOT EXISTS tenants (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT UNIQUE NOT NULL,
  name              TEXT NOT NULL,
  custom_domain     TEXT,
  logo_url          TEXT,
  primary_color     TEXT DEFAULT '#6C47FF',
  owner_email       TEXT NOT NULL,
  plan              TEXT DEFAULT 'starter',       -- starter | growth | pro | enterprise
  status            TEXT DEFAULT 'trial',         -- trial | active | trial_expired | suspended | cancelled
  currency          TEXT NOT NULL DEFAULT 'XAF',  -- XAF | NGN | USD | XOF — tenant-configured
  grace_period_days INT DEFAULT 3,
  timezone          TEXT DEFAULT 'Africa/Douala',
  trial_ends_at     TIMESTAMPTZ,
  trial_reminder_7d_sent  BOOLEAN DEFAULT false,
  trial_reminder_2d_sent  BOOLEAN DEFAULT false,
  onboarding_completed_steps TEXT[] DEFAULT '{}',
  onboarding_completed_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
